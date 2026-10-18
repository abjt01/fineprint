import assert from "node:assert/strict";
import { test } from "node:test";
import { Wallet } from "ethers";
import { build, digestOf, verifyReceipt } from "../../lib/receipt.js";
import { check } from "../../lib/reader.js";
import { flags } from "../../lib/rules.js";
import { checkSignature, sha256 } from "../../lib/tee.js";

const pages = [
  "2. RENT: The Tenant shall pay a monthly rent of Rs. 32,000/- (Rupees Thirty Two Thousand only)\n4. SECURITY DEPOSIT: The Tenant has paid a sum of Rs. 3,20,000/- as interest free refundable security deposit.",
  "7. NOTICE: the Tenant shall give 2 (two) months notice in writing. The Owner may terminate this tenancy by giving 1 (one) month notice.\n8. PAINTING: a sum of Rs. 32,000/- shall be deducted towards painting, irrespective of the condition of the premises.",
];

const clause = (key, value, quote, page, unit = "rs") => ({ key, label: key, unit, found: true, answer: "", value, quote, page });

const read = [
  clause("rent", 32000, "shall pay a monthly rent of Rs. 32,000/-", 1),
  clause("deposit", 320000, "has paid a sum of Rs. 3,20,000/- as interest free", 1),
  clause("notice_tenant", 2, "the Tenant shall give 2 (two) months notice in writing", 2, "months"),
  clause("notice_owner", 1, "The Owner may terminate this tenancy by giving 1 (one) month notice", 2, "months"),
  clause("painting", 32000, "a sum of Rs. 32,000/- shall be deducted towards painting, irrespective of the condition", 2),
].map((c) => ({ ...c, check: check(pages, c) }));

test("quotes and rupee amounts are found on their page", () => {
  assert.ok(read.every((c) => c.check.status === "verified"));
});

test("a made-up quote, a wrong amount or a quote without its amount is caught", () => {
  assert.equal(check(pages, clause("painting", 32000, "deducted towards painting, irrespective of the condition", 2)).status, "check");
  assert.equal(check(pages, clause("deposit", 320000, "deposit of two months rent only", 1)).status, "check");
  assert.equal(check(pages, clause("rent", 35000, "shall pay a monthly rent of Rs. 32,000/-", 1)).status, "check");
});

test("rules flag the deposit, the fixed painting cut and one-sided notice", () => {
  const titles = flags(read).map((f) => f.title);
  assert.ok(titles.some((t) => /Deposit is 10 months/.test(t)));
  assert.ok(titles.includes("Painting charge is cut whatever the condition"));
  assert.ok(titles.includes("Notice is one-sided"));
});

test("rules ignore clauses that weren't verified", () => {
  const unverified = read.map((c) => (c.key === "deposit" ? { ...c, check: { status: "check" } } : c));
  assert.ok(!flags(unverified).some((f) => /Deposit is/.test(f.title)));
});

test("a receipt verifies, and editing one number breaks it", () => {
  const bytes = Buffer.from("%PDF-1.7 fake");
  const r = build({ fileName: "a.pdf", bytes, pages, clauses: read, flags: flags(read), stake: null, proofs: [] });
  assert.ok(verifyReceipt(r, { bytes, pages }).ok);
  const edited = structuredClone(r);
  edited.clauses[1].value = 64000;
  const result = verifyReceipt(edited);
  assert.equal(result.ok, false);
  // even if the editor fixes up the digest, the amount no longer matches its own quote
  edited.digest = digestOf(edited);
  assert.ok(verifyReceipt(edited).checks.some((c) => !c.ok && /own quote/.test(c.title)));
});

test("an enclave signature over the request and response hashes checks out", async () => {
  const wallet = Wallet.createRandom();
  const requestHash = sha256("{\"q\":1}");
  const responseHash = sha256("{\"a\":2}");
  const text = `${requestHash}:${responseHash}`;
  const signature = await wallet.signMessage(text);
  assert.ok(checkSignature({ text, signature, signingAddress: wallet.address, requestHash, responseHash }).ok);
  assert.equal(checkSignature({ text, signature, signingAddress: Wallet.createRandom().address, requestHash, responseHash }).ok, false);
  assert.equal(checkSignature({ text, signature, signingAddress: wallet.address, requestHash: sha256("x"), responseHash }).ok, false);
});
