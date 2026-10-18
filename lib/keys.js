// Key rotation for Groq. GROQ_API_KEY and GROQ_API_KEYS (comma-separated) form one pool.
// Each key keeps its own tokens-per-minute budget per model (the free tier counts max_tokens up front),
// and a request goes to the key with the most room. A key that gets a 429 rests for as long as Groq
// asks; a key Groq rejects (401/403: revoked or mistyped) is dropped, and the rest carry on.
// Keys are only ever named by their last four characters.

const PER_MINUTE = Number(process.env.LLM_TOKENS_PER_MINUTE || 8000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class NoKeyError extends Error {}

export function createPool(keys, { perMinute = PER_MINUTE, now = () => Date.now() } = {}) {
  const slots = [...new Set(keys.map((k) => String(k || "").trim()).filter(Boolean))].map((key, i) => ({
    id: i + 1,
    key,
    tail: key.slice(-4),
    restUntil: 0,
    dead: false,
    used: new Map(), // model -> [{ at, tokens }]
    calls: 0,
  }));

  const spentOn = (slot, model, t) => {
    const log = slot.used.get(model) || [];
    while (log.length && t - log[0].at > 60_000) log.shift();
    slot.used.set(model, log);
    return log.reduce((a, e) => a + e.tokens, 0);
  };

  // The live slot with the most budget left for this model, or how long until one frees up.
  function pick(model, tokens) {
    const t = now();
    const need = Math.min(tokens, perMinute);
    const live = slots.filter((s) => !s.dead);
    if (!live.length) throw new NoKeyError(slots.length ? "Every Groq key was rejected. Check GROQ_API_KEY and GROQ_API_KEYS." : "No Groq key is set.");
    let best = null;
    let wait = Infinity;
    for (const s of live) {
      const used = spentOn(s, model, t);
      if (s.restUntil > t) {
        wait = Math.min(wait, s.restUntil - t);
        continue;
      }
      if (used + need <= perMinute) {
        if (!best || used < best.used) best = { slot: s, used };
      } else {
        const log = s.used.get(model);
        wait = Math.min(wait, 60_000 - (t - log[0].at));
      }
    }
    if (best) {
      best.slot.used.get(model).push({ at: t, tokens: need });
      best.slot.calls++;
      return { slot: best.slot };
    }
    return { wait: Math.max(250, wait) };
  }

  return {
    size: () => slots.filter((s) => !s.dead).length,
    pick,
    async take(model, tokens) {
      for (;;) {
        const got = pick(model, tokens);
        if (got.slot) return got.slot;
        await sleep(got.wait);
      }
    },
    rest(slot, ms) {
      slot.restUntil = Math.max(slot.restUntil, now() + ms);
    },
    drop(slot) {
      slot.dead = true;
      console.error(`Groq key …${slot.tail} was rejected and is out of the rotation`);
    },
    status: () => slots.map((s) => ({ key: `…${s.tail}`, dead: s.dead, resting: s.restUntil > now(), calls: s.calls })),
  };
}

let shared = null;

export function groqPool() {
  if (!shared) shared = createPool([process.env.GROQ_API_KEY, ...String(process.env.GROQ_API_KEYS || "").split(",")]);
  return shared;
}
