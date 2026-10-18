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

// `enclave: false` reads on Groq even when a TEE is set up: faster, for when privacy isn't the point.
export async function analyse(bytes, fileName, packId, { enclave = true } = {}) {
  const pages = await pdfPages(bytes);
  const pack = getPack(packId) || detect(pages);
  const doc = remember(bytes, pages, fileName);
  const tee = enclave ? teeConfig() : null;
  const { clauses, calls } = await readDocument(pages, pack, { tee });
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
