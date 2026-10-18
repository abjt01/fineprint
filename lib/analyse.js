// One document, start to finish: pick its pack, read the clauses, audit them, work out the flags,
// collect the TEE proofs and seal it all in a receipt.
import { alarms } from "./alarms.js";
import { audit } from "./auditor.js";
import { remember } from "./docs.js";
import { teeConfig } from "./llm.js";
import { detect, getPack } from "./packs/index.js";
import { pdfPages } from "./pdf.js";
import { readDocument } from "./reader.js";
import { build } from "./receipt.js";
import { prove } from "./tee.js";

export async function analyse(bytes, fileName, packId) {
  const pages = await pdfPages(bytes);
  const pack = getPack(packId) || detect(pages);
  const doc = remember(bytes, pages, fileName);
  const { clauses, calls } = await readDocument(pages, pack);
  const tee = teeConfig();
  const [audits, proofs] = await Promise.all([audit(clauses), tee ? Promise.all(calls.map((c) => prove(tee, c))) : []]);
  for (const c of clauses) c.audit = audits?.get(c.key) ?? null;
  const receipt = build({
    kind: "review",
    pack: pack.id,
    fileName,
    bytes,
    pages,
    clauses,
    flags: pack.flags(clauses, pages),
    summary: pack.summary(clauses),
    proofs,
  });
  return {
    receipt,
    pages,
    doc: doc.id,
    pack: { id: pack.id, name: pack.name, questions: pack.questions },
    alarms: alarms(receipt, pages),
    auditRan: Boolean(audits),
  };
}
