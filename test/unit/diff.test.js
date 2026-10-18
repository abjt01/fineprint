import assert from "node:assert/strict";
import { test } from "node:test";
import { compare } from "../../lib/diff.js";
import rent from "../../lib/packs/rent.js";

test("a changed deposit in the printed copy is caught and labelled", () => {
  const draft = ["4. SECURITY DEPOSIT: The Tenant has paid a sum of Rs. 1,92,000/- as refundable security deposit.", "9. REFUND: within 15 (fifteen) days of vacating."];
  const printed = ["4. SECURITY DEPOSIT: The Tenant has paid a sum of Rs. 3,20,000/- as refundable security deposit.", "9. REFUND: within 60 (sixty) days of vacating."];
  const changes = compare(draft, printed, rent);
  assert.equal(changes.length, 2);
  assert.deepEqual(changes[0].numbers, { was: [192000], now: [320000] });
  assert.equal(changes[0].clause.key, "deposit");
  assert.equal(changes[1].pageAfter, 2);
});

test("the same text with different line breaks has no changes", () => {
  assert.equal(compare(["rent of Rs. 32,000/-\nper month"], ["rent of Rs. 32,000/- per\nmonth"], rent).length, 0);
});
