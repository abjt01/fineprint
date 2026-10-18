// Documents stay in memory for an hour after upload so follow-up questions don't need the PDF again.
// Nothing is written to disk. A restart forgets them, and the page then asks for the PDF once more.
import { createHash } from "node:crypto";
import { HttpError } from "./http.js";

const TTL = 60 * 60_000;
const MAX = 200;
const docs = (globalThis.__receiptsDocs ||= new Map());

export function remember(bytes, pages, name) {
  const id = createHash("sha256").update(bytes).digest("hex");
  docs.delete(id);
  docs.set(id, { id, pages, name, bytes, at: Date.now() });
  while (docs.size > MAX) docs.delete(docs.keys().next().value);
  return docs.get(id);
}

export function recall(id) {
  const doc = docs.get(String(id || ""));
  if (!doc || Date.now() - doc.at > TTL) {
    docs.delete(String(id || ""));
    throw new HttpError(410, "That document has expired here. Upload it again.");
  }
  doc.at = Date.now();
  return doc;
}
