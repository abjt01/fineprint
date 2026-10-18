// The receipt: everything the app claims about one agreement, in one JSON file anyone can check later.
// It holds the PDF's hash, every clause with its quote and page, the flags, the auditor's view and,
// when the model ran in a TEE, the enclave's signatures. Its digest covers all of it, so changing
// one number anywhere shows up on the verify page.
import { createHash } from "node:crypto";
import { check } from "./reader.js";
import { checkSignature } from "./tee.js";

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

export function build({ fileName, bytes, pages, clauses, flags, stake, proofs }) {
  const receipt = {
    version: VERSION,
    app: "rent-receipt",
    createdAt: new Date().toISOString(),
    document: { name: fileName, sha256: sha256(bytes), pages: pages.length, pageHashes: pages.map((p) => sha256(p)) },
    clauses: clauses.map(({ key, label, unit, found, answer, value, quote, page, check: c, tries, model, audit }) => ({
      key, label, unit, found, answer, value, quote, page, check: c, tries, model, audit: audit ?? null,
    })),
    flags,
    stake,
    tee: proofs.length ? proofs : null,
  };
  receipt.digest = digestOf(receipt);
  return receipt;
}

// Checks a receipt on its own, and against the PDF when one is given.
export function verifyReceipt(receipt, { bytes = null, pages = null } = {}) {
  const checks = [];
  const add = (ok, title, detail) => checks.push({ ok, title, detail });

  if (!receipt || receipt.app !== "rent-receipt" || !Array.isArray(receipt.clauses)) {
    add(false, "This isn't a Rent Receipt", "The file doesn't have the fields a receipt has.");
    return { ok: false, checks };
  }

  const digest = digestOf(receipt);
  add(digest === receipt.digest, "Nothing in the receipt was changed", digest === receipt.digest ? `Digest ${digest.slice(0, 16)}… matches.` : "The digest doesn't match. Something in this file was edited after it was made.");

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
    if (!p.signature) {
      add(false, `TEE proof for ${p.model}`, p.error ? `The provider didn't return a signature: ${p.error}` : "No signature in this proof.");
      continue;
    }
    const sig = checkSignature(p);
    add(sig.ok, `Signed inside the enclave (${p.model})`, sig.ok ? `Signature recovers to ${p.signingAddress}, the address in the attestation report.` : sig.hashesMatch ? "The signature doesn't recover to the enclave's address." : "The signed hashes aren't the ones in this receipt.");
    if (p.response) {
      const same = sha256(p.response) === p.responseHash;
      add(same, "The signed reply is the one stored here", same ? "sha256 of the stored model reply matches the hash the enclave signed." : "The stored model reply was changed after it was signed.");
    }
  }

  return { ok: checks.every((c) => c.ok), checks };
}
