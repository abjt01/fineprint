import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../lib/http.js";
import { LIMITS, limit, resetLimits, slot } from "../../lib/ratelimit.js";

const req = (ip) => ({ headers: { get: (h) => (h === "x-forwarded-for" ? ip : null) } });

test("each IP gets its own window per route, with headers and a retry time", () => {
  resetLimits();
  const max = LIMITS.check.max;
  for (let i = 0; i < max; i++) assert.equal(limit(req("1.1.1.1"), "check", 1000)["RateLimit-Remaining"], String(max - i - 1));
  assert.throws(() => limit(req("1.1.1.1"), "check", 2000), (e) => e instanceof HttpError && e.status === 429 && Number(e.headers["Retry-After"]) > 0);
  // someone else is unaffected, and the first IP is let back in when the window slides
  assert.ok(limit(req("2.2.2.2"), "check", 2000));
  assert.ok(limit(req("1.1.1.1"), "check", 1000 + 10 * 60_000 + 1));
});

test("only a few AI jobs run at once; the rest wait their turn", async () => {
  resetLimits();
  let running = 0;
  let peak = 0;
  const job = () => slot(async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 20));
    running--;
    return 1;
  });
  const out = await Promise.all(Array.from({ length: 15 }, job));
  assert.equal(out.length, 15);
  assert.ok(peak <= 6, `peak ${peak}`);
});
