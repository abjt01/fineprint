// The receipt: everything the app claims about one document, in one JSON file anyone can check later.
// It holds the PDF's hash, every clause with its quote and page, the flags, the auditor's view and,
// when the model ran in a TEE, the enclave's signatures. Its digest covers all of it, so changing
// one number anywhere shows up on the verify page.
import { createHash } from "node:crypto";
import { check } from "./reader.js";
import { parseJSON } from "./llm.js";
import { checkSignature } from "./tee.js";
import { numbersIn } from "./verify.js";

export const VERSION = 1;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// JSON with keys in a fixed order, so the same receipt always hashes the same
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export const digestOf = (receipt) => sha256(canonical({ ...receipt, digest: undefined }));

export function build({ kind, pack = null, question = null, text = null, fileName, bytes, pages, clauses, flags = [], summary = [], proofs }) {
  const receipt = {
    version: VERSION,
    app: "receipts",
    kind,
    pack,
    question,
    text,
    createdAt: new Date().toISOString(),
    document: { name: fileName, sha256: sha256(bytes), pages: pages.length, pageHashes: pages.map((p) => sha256(p)) },
    clauses: clauses.map(({ key, label, unit, found, verdict, answer, value, quote, page, check: c, tries, model, audit }) => ({
      key, label, unit, found, verdict, answer, value, quote, page, check: c, tries, model, audit: audit ?? null,
    })),
    flags,
    summary,
    tee: proofs.length ? proofs : null,
  };
  receipt.digest = digestOf(receipt);
  return receipt;
}

// Checks a receipt on its own, and against the PDF when one is given.
export function verifyReceipt(receipt, { bytes = null, pages = null } = {}) {
  const checks = [];
  const add = (ok, title, detail) => checks.push({ ok, title, detail });

  if (!receipt || receipt.app !== "receipts" || !Array.isArray(receipt.clauses)) {
    add(false, "This isn't a receipt from here", "The file doesn't have the fields a receipt has.");
    return { ok: false, checks };
  }

  const digest = digestOf(receipt);
  add(digest === receipt.digest, "Nothing in the receipt was changed", digest === receipt.digest ? `Digest ${digest.slice(0, 16)}… matches.` : "The digest doesn't match. Something in this file was edited after it was made.");

  // works with no PDF at all: an amount that isn't written in its own quote was typed in by someone
  const money = receipt.clauses.filter((c) => c.found && Number.isFinite(c.value) && (c.unit === "rs" || c.unit === "percent"));
  const off = money.filter((c) => !numbersIn(c.quote).has(c.value));
  add(!off.length, "Every amount is written in its own quote", off.length ? off.map((c) => `${c.label} says ${c.value}, but its quote doesn't.`).join(" ") : `${money.length} amounts checked against their quotes.`);

  if (bytes && pages) {
    const same = sha256(bytes) === receipt.document?.sha256;
    add(same, "It's the same PDF", same ? "The PDF's sha256 matches the one in the receipt." : "This PDF is different from the one the receipt was made for.");
    for (const c of receipt.clauses.filter((x) => x.found)) {
      const now = check(pages, c);
      const ok = now.status === "verified";
      add(ok, `${c.label}: quote is on page ${c.page}`, ok ? `“${c.quote.slice(0, 90)}${c.quote.length > 90 ? "…" : ""}”` : `Not found in this PDF: ${now.why}`);
    }
  }

  for (const p of receipt.tee || []) {
    if (p.kind === "attested-channel") {
      const a = p.attestation || {};
      const ok = Boolean(a.securityVerified && a.codeFingerprint && a.codeFingerprint === a.enclaveFingerprint);
      add(ok, `Read inside an enclave (${p.model})`, ok ? `${a.configRepo} ${a.releaseTag || ""}: the enclave's measured code matches the public release (${String(a.codeFingerprint).slice(0, 16)}…), checked ${a.verifiedAt || "before the call"}.` : p.error ? `The enclave couldn't be verified: ${p.error}` : "The enclave's measurement doesn't match the published code.");
    } else if (!p.signature) {
      add(false, `TEE proof for ${p.model}`, p.error ? `The provider didn't return a signature: ${p.error}` : "No signature in this proof.");
      continue;
    } else {
      const sig = checkSignature(p);
      add(sig.ok, `Signed inside the enclave (${p.model})`, sig.ok ? `Signature recovers to ${p.signingAddress}, the address in the attestation report.` : sig.hashesMatch ? "The signature doesn't recover to the enclave's address." : "The signed hashes aren't the ones in this receipt.");
    }
    if (p.response) {
      const same = sha256(p.response) === p.responseHash;
      add(same, "The model's reply is the one stored here", same ? "sha256 of the stored reply matches the hash recorded with the proof." : "The stored model reply was changed after the proof was made.");
      const changed = changedSince(p.response, receipt.clauses);
      if (changed) add(!changed.length, "The clauses are what the enclave said", changed.length ? `Different from the enclave's reply: ${changed.join(", ")}.` : "Every value and quote here matches the enclave's reply.");
    }
  }

  return { ok: checks.every((c) => c.ok), checks };
}

// Clauses whose value or quote differs from what the model said in a signed reply.
function changedSince(response, clauses) {
  let said;
  try {
    said = parseJSON(JSON.parse(response).choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  }
  const list = Array.isArray(said?.clauses) ? said.clauses : said?.key ? [said] : [];
  // answers and fact-checks are signed as sentences and claims, which this comparison doesn't cover
  if (!list.length) return null;
  const out = [];
  for (const s of list) {
    const c = clauses.find((x) => x.key === s?.key);
    // a clause re-asked on a second try is covered by that second reply instead
    if (!c || !s.found || c.tries > 1) continue;
    const v = s.value === null || s.value === undefined || s.value === "" ? null : Number(String(s.value).replace(/,/g, ""));
    if ((Number.isFinite(v) ? v : null) !== c.value || String(s.quote).slice(0, 400) !== c.quote) out.push(c.label);
  }
  return out;
}
