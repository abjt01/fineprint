import assert from "node:assert/strict";
import { test } from "node:test";
import { Wallet } from "ethers";
import { build, digestOf, verifyReceipt } from "../../lib/receipt.js";
import { check } from "../../lib/reader.js";
import { detect } from "../../lib/packs/index.js";
import loan, { emi, impliedRate } from "../../lib/packs/loan.js";
import rent from "../../lib/packs/rent.js";

const flags = (c) => rent.flags(c);
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
  const r = build({ kind: "review", pack: "rent", fileName: "a.pdf", bytes, pages, clauses: read, flags: flags(read), summary: rent.summary(read), proofs: [] });
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

test("packs are picked by keywords", () => {
  assert.equal(detect(pages).id, "rent");
  assert.equal(detect(["This offer letter confirms your employment. Your CTC is Rs. 12,00,000. Probation is six months. Notice period 90 days. Joining date. Salary. Designation."]).id, "job");
  assert.equal(detect(["The weather was pleasant and the train was late."]).id, "general");
});

test("loan maths catches a flat rate dressed up as a low one", () => {
  assert.equal(Math.round(emi(100000, 12, 12)), 8885);
  assert.ok(Math.abs(impliedRate(100000, 8885, 12) - 12) < 0.05);
  const v = (key, value) => ({ key, value, quote: "", answer: "", check: { status: "verified" } });
  // Rs. 1,00,000 at "12% flat" for 12 months is 12 EMIs of 9,333
  const titles = loan.flags([v("principal", 100000), v("rate", 12), v("tenure", 12), v("emi", 9333)]).map((f) => f.title);
  assert.ok(titles.some((t) => /real rate is about 2\d\.\d%/.test(t)), titles.join(" | "));
});

test("rent alarms land on the right days", async () => {
  const { alarms } = await import("../../lib/alarms.js");
  const c = (key, value, quote) => ({ key, value, quote, answer: "", check: { status: "verified", page: 1 } });
  const out = alarms({
    pack: "rent",
    clauses: [
      c("term", 11, "for a period of 11 (eleven) months commencing from 01-11-2026 and ending on 30-09-2027"),
      c("rent", 32000, "a monthly rent of Rs. 32,000/- on or before the 5th day of every English calendar month"),
      c("lockin", 6, "lock-in period of 6 (six) months"),
      c("notice_tenant", 2, "the Tenant shall give 2 (two) months notice"),
      c("refund", 60, "refunded within 60 (sixty) days"),
    ],
  });
  const by = Object.fromEntries(out.map((a) => [a.title, a]));
  assert.equal(by["Lock-in ends"].date, "2027-05-01");
  assert.equal(by["Last day to give notice"].date, "2027-08-01");
  assert.equal(by["Deposit refund is due"].date, "2027-11-29");
  assert.equal(by["Rent due tomorrow"].monthlyDay, 4);
});

test("a painting quote that stops short still gets the fixed-charge flag from the rest of its sentence", () => {
  const short = { key: "painting", value: 32000, quote: "a sum of Rs. 32,000/- shall be deducted towards painting", answer: "", check: { status: "verified", page: 2 } };
  const titles = rent.flags([short], pages).map((f) => f.title);
  assert.ok(titles.includes("Painting charge is cut whatever the condition"));
});
