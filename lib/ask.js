// Two ways to question a document after it's uploaded:
//   ask:       a plain question, answered in short sentences, each with its own quote
//   factcheck: someone else's AI answer, split into claims, each one supported, contradicted or not in the document
// Either way the quotes are found in the PDF by code, a second model audits the reading,
// and the result is sealed in a receipt like any review.
import { audit } from "./auditor.js";
import { chatJSON, teeConfig } from "./llm.js";
import { MODELS } from "./reader.js";
import { build } from "./receipt.js";
import { asPrompt, excerpts } from "./search.js";
import { prove } from "./tee.js";
import { numbersIn, verify } from "./verify.js";

const RULES = `Rules:
- Use only the excerpts. Each excerpt starts with [page N].
- Every "quote" is copied exactly, word for word, from one excerpt (15 to 220 characters, no "..."), and "page" is that excerpt's N.
- Reply with one JSON object and nothing else.`;

const ASK_SYSTEM = `You answer questions about one document for the ordinary person who has to live with it. Answer in plain, short sentences.
${RULES}
- Every sentence of your answer has its own quote that proves it. A sentence you can't prove with a quote doesn't go in.
- If the excerpts don't answer the question, return "sentences": [] and say so in "missing".`;

const CHECK_SYSTEM = `You fact-check text that another AI wrote about a document, against the document itself.
${RULES}
- Split the text into separate factual claims (at most 10). Skip greetings, advice and opinions.
- For each claim: "supported" when a line in the excerpts says the same thing, numbers included; "contradicted" when a line says something different; "not_found" when the excerpts don't cover it.
- For supported and contradicted claims, "quote" is that line. For contradicted claims, "correction" says what the document actually says.`;

const sentences = (s) =>
  String(s)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 12)
    .slice(0, 20);

// A sentence is proven when its quote is on the page and every number it states is written there too.
function prove1(pages, text, quote, page) {
  if (!quote) return { status: "check", why: "No line was given for this." };
  return verify(pages, { quote, page, numbers: [...numbersIn(text)] });
}

async function call({ model, system, user, maxTokens }) {
  const tee = teeConfig();
  if (tee) {
    const out = await chatJSON({ model: tee.model, system, user, maxTokens, tee, temperature: 0.2 });
    return { json: out.json, call: { model: out.model, id: out.id, request: out.request, response: out.response }, model: tee.model };
  }
  return { json: await chatJSON({ model, system, user, maxTokens, temperature: 0.2 }), call: null, model };
}

async function seal({ kind, doc, items, question = null, text = null, calls }) {
  const verifiedItems = items.filter((i) => i.check.status === "verified");
  const audits = await audit(verifiedItems);
  for (const i of items) i.audit = audits?.get(i.key) ?? null;
  const tee = teeConfig();
  const proofs = tee ? await Promise.all(calls.filter(Boolean).map((c) => prove(tee, c))) : [];
  const receipt = build({ kind, fileName: doc.name, bytes: doc.bytes, pages: doc.pages, clauses: items, question, text, proofs });
  return { receipt, auditRan: Boolean(audits) };
}

export async function ask(doc, question) {
  const parts = excerpts(doc.pages, [question], 6000);
  const user = `Question: ${question}

Return:
{ "sentences": [ { "text": "one short sentence", "quote": "...", "page": 1 } ], "missing": "what the document doesn't say, or null" }

Excerpts:
${asPrompt(parts)}`;
  const { json, call: c, model } = await call({ model: MODELS.big, system: ASK_SYSTEM, user, maxTokens: 1200 });
  const items = (Array.isArray(json?.sentences) ? json.sentences : []).slice(0, 8).map((s, i) => {
    const textOut = String(s?.text || "").slice(0, 400);
    const quote = String(s?.quote || "").slice(0, 400);
    const page = Number.isInteger(Number(s?.page)) ? Number(s.page) : null;
    return {
      key: `s${i + 1}`,
      label: textOut,
      unit: null,
      found: true,
      answer: textOut,
      value: null,
      quote,
      page,
      check: prove1(doc.pages, textOut, quote, page),
      tries: 1,
      model,
    };
  });
  const sealed = await seal({ kind: "answer", doc, items, question, calls: [c] });
  return { ...sealed, missing: json?.missing ? String(json.missing).slice(0, 300) : null };
}

export async function factcheck(doc, text) {
  const parts = excerpts(doc.pages, sentences(text), 7000);
  const user = `Text to check:
"""
${text}
"""

Return:
{ "claims": [ { "claim": "one claim from the text, in its words", "verdict": "supported | contradicted | not_found", "quote": "... or null", "page": 1, "correction": "what the document says, only when contradicted" } ] }

Excerpts:
${asPrompt(parts)}`;
  const { json, call: c, model } = await call({ model: MODELS.small, system: CHECK_SYSTEM, user, maxTokens: 1800 });
  const items = (Array.isArray(json?.claims) ? json.claims : []).slice(0, 10).map((x, i) => {
    const claim = String(x?.claim || "").slice(0, 400);
    const verdict = ["supported", "contradicted"].includes(x?.verdict) ? x.verdict : "not_found";
    const quote = verdict === "not_found" ? "" : String(x?.quote || "").slice(0, 400);
    const page = Number.isInteger(Number(x?.page)) ? Number(x.page) : null;
    const correction = verdict === "contradicted" ? String(x?.correction || "").slice(0, 300) : "";
    // a supported claim must have its own numbers on the page; a contradiction only needs its line to exist
    const check =
      verdict === "not_found"
        ? { status: "missing", why: "The document doesn't cover this claim." }
        : verdict === "supported"
          ? prove1(doc.pages, claim, quote, page)
          : verify(doc.pages, { quote, page });
    return {
      key: `c${i + 1}`,
      label: claim,
      unit: null,
      found: verdict !== "not_found",
      verdict,
      answer: verdict === "contradicted" ? correction || "The document says something different." : claim,
      value: null,
      quote,
      page,
      check,
      tries: 1,
      model,
    };
  });
  return seal({ kind: "factcheck", doc, items, text, calls: [c] });
}
