import { normalise } from "../verify.js";

// Shared bits for packs. A pack is one kind of document: the clauses worth reading out of it,
// and plain-code rules that turn verified clauses into flags and a money summary.

export const rupees = (n) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
export const months = (n) => `${Number(n.toFixed(1))} month${n === 1 ? "" : "s"}`;

// Rules only ever see clauses whose quote was found in the document. `text` also takes in the rest of
// the sentence after the quote on its page, because a model's quote often stops just before
// "irrespective of the condition".
export function afterQuote(c, pages) {
  const page = normalise(pages?.[c.check.page - 1] || "");
  const head = normalise(c.quote).slice(0, 40);
  const at = head ? page.indexOf(head) : -1;
  return at === -1 ? "" : page.slice(at, at + normalise(c.quote).length + 200);
}

export function verified(clauses, pages = null) {
  const ok = new Map(clauses.filter((c) => c.check?.status === "verified").map((c) => [c.key, c]));
  const after = (c) => afterQuote(c, pages);
  return {
    has: (k) => ok.has(k),
    get: (k) => ok.get(k),
    num: (k) => (Number.isFinite(ok.get(k)?.value) ? ok.get(k).value : null),
    text: (k) => (ok.has(k) ? `${ok.get(k).quote} ${ok.get(k).answer} ${after(ok.get(k))}` : ""),
  };
}

export function collector() {
  const out = [];
  const add = (level, title, detail, keys, law = null) => out.push({ level, title, detail, keys, law });
  const order = { red: 0, amber: 1, info: 2 };
  const done = () => out.sort((a, b) => order[a.level] - order[b.level]);
  return { add, done };
}
