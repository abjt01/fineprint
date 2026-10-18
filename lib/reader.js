// Reads a rental agreement as a short list of clauses a tenant actually loses money on.
// Each clause comes back with a quote and a page, and code checks the quote is really there.
// When a quote can't be found, the model is shown the page and asked once more (self-correction);
// if it still can't point at the line, the clause is shown as "check this yourself".
import { chatJSON, teeConfig } from "./llm.js";
import { asPrompt, excerpts } from "./search.js";
import { numbersIn, verify } from "./verify.js";

export const MODELS = {
  big: process.env.READ_MODEL || "openai/gpt-oss-120b",
  small: process.env.READ_MODEL_SMALL || "openai/gpt-oss-20b",
  audit: process.env.AUDIT_MODEL || "qwen/qwen3.8-27b",
};

// unit is what `value` is counted in; "rs" amounts are rupees
export const CLAUSES = [
  { key: "rent", label: "Monthly rent", unit: "rs", group: "money", hint: "monthly rent amount" },
  { key: "deposit", label: "Security deposit", unit: "rs", group: "money", hint: "security deposit / advance amount" },
  { key: "maintenance", label: "Maintenance charges", unit: "rs", group: "money", hint: "monthly maintenance or society charges, and who pays" },
  { key: "late_fee", label: "Late payment fee", unit: "rs", group: "money", hint: "penalty or late fee for paying rent late" },
  { key: "hike", label: "Rent increase", unit: "percent", group: "money", hint: "rent enhancement or escalation percent and when" },
  { key: "painting", label: "Painting / cleaning deduction", unit: "rs", group: "money", hint: "painting or cleaning charges deducted from the deposit" },
  { key: "refund", label: "Deposit refund time", unit: "days", group: "money", hint: "how many days after vacating the deposit is returned" },
  { key: "term", label: "Agreement period", unit: "months", group: "terms", hint: "length of the tenancy and start date" },
  { key: "lockin", label: "Lock-in period", unit: "months", group: "terms", hint: "lock-in period and penalty for leaving early" },
  { key: "notice_tenant", label: "Notice the tenant must give", unit: "months", group: "terms", hint: "notice period the tenant gives before vacating" },
  { key: "notice_owner", label: "Notice the owner must give", unit: "months", group: "terms", hint: "notice period the owner/landlord gives to end the tenancy" },
  { key: "repairs", label: "Who pays for repairs", unit: null, group: "terms", hint: "who bears repairs: plumbing, electrical, structural, seepage" },
  { key: "electricity", label: "Electricity rate", unit: "rs", group: "terms", hint: "electricity charges per unit or sub-meter" },
  { key: "restrictions", label: "House rules", unit: null, group: "terms", hint: "restrictions on pets, guests, food, visitors, use" },
];

export const SYSTEM = `You read Indian residential rental agreements for the tenant, who is about to sign one or wants their deposit back.

You get excerpts from one agreement. Each excerpt starts with [page N].

Rules:
- Use only the excerpts. If they don't cover a clause, return it with "found": false. Never fill gaps from what agreements usually say.
- Every found clause has "quote": a phrase copied exactly, word for word, from one excerpt (20 to 220 characters, no "..."), and "page": the N of that excerpt. The quote must contain the clause's numbers.
- "value" is one plain number in the clause's unit (rupees without commas, percent, days or months), or null when the clause has no single number. Rs. 3,20,000 is 320000.
- "answer" is one short plain-English sentence a tenant understands, with the numbers in it.
- Reply with one JSON object and nothing else.`;

const JOBS = [
  { group: "money", model: "big", budget: 9000 },
  { group: "terms", model: "small", budget: 9000 },
];

function jobPrompt(clauses, pages, budget) {
  const parts = excerpts(pages, clauses.map((c) => `${c.label} ${c.hint}`), budget);
  const list = clauses.map((c) => `- "${c.key}": ${c.label} (${c.hint})${c.unit ? `, value in ${c.unit}` : ", value null"}`).join("\n");
  return `Clauses to find:
${list}

Return:
{ "clauses": [ { "key": "rent", "found": true, "answer": "...", "value": 32000, "quote": "...", "page": 1 } ] }
One entry per clause key above, in that order.

Excerpts:
${asPrompt(parts)}`;
}

// A clause is verified when its quote is on the page and its amount is written in the quote itself.
// Months and days are often written in words ("eleven months"), so for those only the quote has to match.
export function check(pages, clause) {
  if (!clause.found) return { status: "missing", why: "The agreement doesn't seem to say." };
  const money = Number.isFinite(clause.value) && (clause.unit === "rs" || clause.unit === "percent");
  const result = verify(pages, { quote: clause.quote, page: clause.page, numbers: money ? [clause.value] : [] });
  if (result.status === "verified" && money && !numbersIn(clause.quote).has(clause.value)) {
    return { status: "check", why: `${clause.value} isn't in the quoted line.`, page: result.page };
  }
  return result;
}

function tidy(def, raw) {
  const found = Boolean(raw?.found && raw?.quote);
  const value = raw?.value === null || raw?.value === undefined || raw?.value === "" ? null : Number(String(raw.value).replace(/,/g, ""));
  return {
    key: def.key,
    label: def.label,
    unit: def.unit,
    group: def.group,
    found,
    answer: found ? String(raw.answer || "").slice(0, 300) : "",
    value: found && Number.isFinite(value) ? value : null,
    quote: found ? String(raw.quote).slice(0, 400) : "",
    page: Number.isInteger(Number(raw?.page)) ? Number(raw.page) : null,
  };
}

const RETRY = `Your quote for this clause isn't in the agreement as written. Here is the full text of the page you named and the pages around it.
Copy the quote again, exactly as it is written there, character for character. If the clause really isn't there, return "found": false.
Return: { "key": "...", "found": true, "answer": "...", "value": 0, "quote": "...", "page": 1 }`;

async function retry(pages, clause, call) {
  const around = [clause.page - 1, clause.page, clause.page + 1].filter((p) => p >= 1 && p <= pages.length);
  const text = (around.length ? around : pages.map((_, i) => i + 1)).map((p) => `[page ${p}]\n${pages[p - 1]}`).join("\n\n");
  const user = `${RETRY}\n\nClause: "${clause.key}" (${clause.label}). Your first quote was: "${clause.quote}" on page ${clause.page}.\n\n${text}`;
  return call(user, 1200);
}

export async function readAgreement(pages, { onStep = () => {} } = {}) {
  const tee = teeConfig();
  const calls = [];
  const ask = (model) => async (user, maxTokens) => {
    if (tee) {
      const out = await chatJSON({ model: tee.model, system: SYSTEM, user, maxTokens, tee, temperature: 0.2 });
      calls.push({ model: out.model, id: out.id, request: out.request, response: out.response });
      return out.json;
    }
    return chatJSON({ model, system: SYSTEM, user, maxTokens, temperature: 0.2 });
  };

  const results = await Promise.all(
    JOBS.map(async (job) => {
      const defs = CLAUSES.filter((c) => c.group === job.group);
      const model = MODELS[job.model];
      const reply = await ask(model)(jobPrompt(defs, pages, job.budget), 3500);
      const byKey = new Map((reply?.clauses || []).map((c) => [c?.key, c]));
      onStep(`read ${job.group}`);
      return Promise.all(
        defs.map(async (def) => {
          let clause = tidy(def, byKey.get(def.key));
          let result = check(pages, clause);
          let tries = 1;
          if (result.status === "check") {
            try {
              const second = tidy(def, await retry(pages, clause, ask(model)));
              const again = check(pages, second);
              tries = 2;
              if (again.status !== "check" || second.found) {
                clause = second;
                result = again;
              }
            } catch {
              // keep the first answer and its red stamp
            }
          }
          return { ...clause, check: result, tries, model: tee ? tee.model : model };
        }),
      );
    }),
  );
  return { clauses: results.flat(), calls };
}
