// One agreement, start to finish: read the clauses, audit them, work out the flags,
// collect the TEE proofs and seal it all in a receipt.
import { audit } from "./auditor.js";
import { teeConfig } from "./llm.js";
import { pdfPages } from "./pdf.js";
import { readAgreement } from "./reader.js";
import { build } from "./receipt.js";
import { atStake, flags } from "./rules.js";
import { prove } from "./tee.js";

export async function analyse(bytes, fileName) {
  const pages = await pdfPages(bytes);
  const { clauses, calls } = await readAgreement(pages);
  const tee = teeConfig();
  const [audits, proofs] = await Promise.all([audit(clauses), tee ? Promise.all(calls.map((c) => prove(tee, c))) : []]);
  for (const c of clauses) c.audit = audits?.get(c.key) ?? null;
  const receipt = build({ fileName, bytes, pages, clauses, flags: flags(clauses), stake: atStake(clauses), proofs });
  return { receipt, pages, auditRan: Boolean(audits) };
}
