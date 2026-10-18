// A second model, from a different family, reads each verified quote next to the answer the first model
// wrote and says whether the quote really supports it. The quote check proves the line exists;
// this catches a real line read the wrong way (the owner's notice shown as the tenant's).
import { chatJSON } from "./llm.js";
import { MODELS } from "./reader.js";

const SYSTEM = `You audit another AI's reading of a document. For each item you get what it's about, the line quoted from the document, and the other AI's answer.
Say whether the quoted line alone supports the answer, including every number and who it applies to.
Reply with one JSON object: { "items": [ { "key": "...", "agrees": true, "note": "under 15 words, only when agrees is false" } ] }`;

export async function audit(clauses) {
  const items = clauses.filter((c) => c.check?.status === "verified");
  if (!items.length) return new Map();
  const user = items.map((c) => `key: ${c.key}\nclause: ${c.label}\nquote: "${c.quote}"\nanswer: ${c.answer}`).join("\n\n");
  try {
    // Qwen's free-tier output allowance is about 1,000 tokens a minute, so the reply has to stay short
    const reply = await chatJSON({ model: MODELS.audit, system: SYSTEM, user, maxTokens: 900, effort: "none", temperature: 0, attempts: 2 });
    return new Map((reply?.items || []).filter((i) => i?.key).map((i) => [i.key, { agrees: i.agrees !== false, note: String(i.note || "").slice(0, 160), model: MODELS.audit }]));
  } catch (err) {
    console.error("audit failed:", err.message);
    return null;
  }
}
