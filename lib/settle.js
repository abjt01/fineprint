// Money day. Months after signing, the landlord sends "deducting 45k: painting 32k, cleaning 8k, fan 5k".
// This checks each deduction against the receipt made when the agreement was signed:
// a model only splits the message into lines and says which clause each line claims to come from,
// then code decides allowed, over the limit, or not in the agreement, and writes the reply.
import { HttpError } from "./http.js";
import { chatJSON } from "./llm.js";
import { rupees } from "./packs/util.js";
import { MODELS } from "./reader.js";
import { verifyReceipt } from "./receipt.js";
import { numbersIn } from "./verify.js";

const SYSTEM = `You split a message about money deducted or withheld under an agreement into separate line items.
For each item give: "what" (a few words, as the message says it), "amount" (rupees as a plain number, exactly as written in the message), and "clause": the key of the agreement clause it would fall under, from the list you're given, or null if none of them covers it. Don't decide whether it's fair.
Reply with one JSON object: { "items": [ { "what": "...", "amount": 0, "clause": "key or null" } ] }`;

export async function settle(receipt, message) {
  const base = verifyReceipt(receipt);
  if (!base.ok) throw new HttpError(422, "This receipt doesn't verify, so it can't be used to check deductions. Use the original file.");

  const clauses = receipt.clauses.filter((c) => c.found && c.check?.status === "verified");
  const list = clauses.map((c) => `- ${c.key}: ${c.label}. ${c.answer}`).join("\n");
  const reply = await chatJSON({
    model: MODELS.small,
    system: SYSTEM,
    user: `Agreement clauses:\n${list}\n\nMessage:\n"""\n${message}\n"""`,
    maxTokens: 900,
    temperature: 0,
  });

  const written = numbersIn(message);
  // "45k" and "32K" are how people write in chats
  for (const m of String(message).matchAll(/(\d+(?:\.\d+)?)\s*k\b/gi)) written.add(Math.round(Number(m[1]) * 1000));
  for (const m of String(message).matchAll(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/gi)) written.add(Math.round(Number(m[1]) * 100000));

  const items = (Array.isArray(reply?.items) ? reply.items : [])
    .slice(0, 15)
    .map((i) => ({ what: String(i?.what || "").slice(0, 80), amount: Number(String(i?.amount ?? "").replace(/,/g, "")), clause: clauses.find((c) => c.key === i?.clause) || null }))
    .filter((i) => i.what && Number.isFinite(i.amount) && i.amount > 0);

  // several lines can lean on one clause (painting 32k + cleaning 8k under "painting and cleaning"), so limits apply per clause
  const used = new Map();
  const lines = items.map((i) => {
    if (!written.has(i.amount)) return { ...i, status: "unclear", allowed: 0, why: `Couldn't find ${rupees(i.amount)} written in the message.` };
    if (!i.clause) return { ...i, status: "not_in_agreement", allowed: 0, why: "No clause in the agreement covers this." };
    const c = i.clause;
    if (Number.isFinite(c.value) && c.unit === "rs") {
      const left = Math.max(0, c.value - (used.get(c.key) || 0));
      const allowed = Math.min(i.amount, left);
      used.set(c.key, (used.get(c.key) || 0) + allowed);
      if (allowed === i.amount) return { ...i, status: "allowed", allowed, why: `Within ${c.label.toLowerCase()}: ${rupees(c.value)}.` };
      return { ...i, status: "over", allowed, why: `${c.label} is capped at ${rupees(c.value)}${allowed ? `, and only ${rupees(allowed)} of that is left` : ", already used up by other lines"}.` };
    }
    return { ...i, status: "ask_bills", allowed: i.amount, why: `${c.label} allows it, but sets no amount. Ask for the bill.` };
  });

  const claimed = lines.reduce((a, l) => a + l.amount, 0);
  const allowed = lines.reduce((a, l) => a + (l.status === "ask_bills" || l.status === "allowed" || l.status === "over" ? l.allowed : 0), 0);
  const deposit = receipt.clauses.find((c) => c.key === "deposit" && c.check?.status === "verified")?.value ?? null;
  const refund = receipt.clauses.find((c) => c.key === "refund" && c.check?.status === "verified");

  return {
    lines: lines.map(({ clause, ...l }) => ({ ...l, clause: clause && { key: clause.key, label: clause.label, page: clause.check.page, quote: clause.quote } })),
    claimed,
    allowed,
    disputed: claimed - allowed,
    deposit,
    owed: deposit ? deposit - allowed : null,
    draft: draft(lines, { claimed, allowed, deposit, refund, digest: receipt.digest }),
  };
}

// The reply is written by code, not by a model, so every number and page in it is one that was checked.
function draft(lines, { claimed, allowed, deposit, refund, digest }) {
  const out = ["Hi, thanks for the details on the deposit. I checked each deduction against our agreement:", ""];
  for (const l of lines) {
    const ref = l.clause ? ` (agreement page ${l.clause.page}: "${l.clause.quote.slice(0, 140)}${l.clause.quote.length > 140 ? "…" : ""}")` : "";
    if (l.status === "allowed") out.push(`- ${l.what}, ${rupees(l.amount)}: agreed${ref}.`);
    else if (l.status === "over") out.push(`- ${l.what}, ${rupees(l.amount)}: the agreement allows only ${rupees(l.allowed)} for this${ref}.`);
    else if (l.status === "ask_bills") out.push(`- ${l.what}, ${rupees(l.amount)}: fine if there's a bill for it, please share it${ref}.`);
    else if (l.status === "not_in_agreement") out.push(`- ${l.what}, ${rupees(l.amount)}: this isn't in our agreement, so it can't be deducted.`);
    else out.push(`- ${l.what}: I couldn't follow the amount here, can you clarify?`);
  }
  out.push("");
  if (deposit) out.push(`So the deductions come to ${rupees(allowed)}, not ${rupees(claimed)}, and the refund should be ${rupees(deposit - allowed)} of the ${rupees(deposit)} deposit.`);
  else out.push(`So the deductions come to ${rupees(allowed)}, not ${rupees(claimed)}.`);
  if (refund) out.push(`As per page ${refund.check.page}, it's due within ${refund.value} days of handing over the keys.`);
  out.push("", `(Checked with Receipts, receipt ${digest.slice(0, 12)}. You can verify it yourself.)`);
  return out.join("\n");
}
