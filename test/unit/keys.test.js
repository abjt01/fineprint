import assert from "node:assert/strict";
import { test } from "node:test";
import { NoKeyError, createPool } from "../../lib/keys.js";

test("requests spread across keys by remaining budget", () => {
  const pool = createPool(["k1", "k2", "k2", ""], { perMinute: 1000, now: () => 0 });
  assert.equal(pool.size(), 2);
  assert.equal(pool.pick("m", 600).slot.key, "k1");
  assert.equal(pool.pick("m", 600).slot.key, "k2");
  // both have 400 left, so a 600-token request has to wait
  assert.ok(pool.pick("m", 600).wait > 0);
  // a different model has its own budget on each key
  assert.ok(pool.pick("other", 600).slot);
});

test("a resting key is skipped and a rejected key is dropped", () => {
  let t = 0;
  const pool = createPool(["k1", "k2"], { perMinute: 1000, now: () => t });
  const first = pool.pick("m", 10).slot;
  pool.rest(first, 5000);
  assert.notEqual(pool.pick("m", 10).slot.key, first.key);
  t = 6000;
  pool.drop(pool.pick("m", 10).slot);
  assert.equal(pool.size(), 1);
});

test("no keys at all is a clear error", () => {
  assert.throws(() => createPool([]).pick("m", 10), NoKeyError);
});
