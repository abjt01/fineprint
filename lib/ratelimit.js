// Rate limits, so one visitor (or one script) can't burn the free Groq and Tinfoil quota for everyone.
// Three layers:
//   per IP, per route, over 10 minutes (a sliding window)
//   per IP, all AI routes together, per day
//   across everyone, how many AI jobs run at once (the rest wait briefly, then get a "busy")
// Every answer carries RateLimit-* headers, and a 429 says how many seconds to wait.
import { HttpError } from "./http.js";

const MINUTE = 60_000;
const scale = Number(process.env.RATE_LIMIT_SCALE || 1);

// requests per 10 minutes per IP; `ai` routes also count towards the daily cap
export const LIMITS = {
  check: { max: 15, ai: true },
  ask: { max: 40, ai: true },
  settle: { max: 30, ai: true },
  compare: { max: 60, ai: false },
  verify: { max: 120, ai: false },
};
const WINDOW = 10 * MINUTE;
const DAILY_AI = 200;
const MAX_RUNNING = Number(process.env.MAX_AI_JOBS || 6);
const MAX_QUEUE_WAIT = 20_000;

const state = (globalThis.__rrLimits ||= { hits: new Map(), running: 0, waiting: [], swept: 0 });

export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") || "local").trim();
}

function count(key, windowMs, now) {
  const list = (state.hits.get(key) || []).filter((t) => now - t < windowMs);
  state.hits.set(key, list);
  return list;
}

function sweep(now) {
  if (now - state.swept < 5 * MINUTE) return;
  state.swept = now;
  for (const [k, list] of state.hits) if (!list.length || now - list.at(-1) > 24 * 60 * MINUTE) state.hits.delete(k);
}

const disabled = () => process.env.DISABLE_RATE_LIMIT === "1";

// Throws a 429 with Retry-After when over a limit; otherwise records the hit and returns the headers to send.
export function limit(req, route, now = Date.now()) {
  const rule = LIMITS[route];
  if (!rule || disabled()) return {};
  sweep(now);
  const ip = clientIp(req);
  const max = Math.max(1, Math.round(rule.max * scale));
  const recent = count(`${route}:${ip}`, WINDOW, now);
  if (recent.length >= max) {
    const wait = Math.ceil((WINDOW - (now - recent[0])) / 1000);
    throw new HttpError(429, `That's a lot of requests from you in a short time. Try again in ${pretty(wait)}.`, retryHeaders(max, 0, wait));
  }
  if (rule.ai) {
    const day = count(`day:${ip}`, 24 * 60 * MINUTE, now);
    const cap = Math.max(1, Math.round(DAILY_AI * scale));
    if (day.length >= cap) {
      const wait = Math.ceil((24 * 60 * MINUTE - (now - day[0])) / 1000);
      throw new HttpError(429, `You've used today's ${cap} AI reads. They come back in ${pretty(wait)}.`, retryHeaders(cap, 0, wait));
    }
    day.push(now);
  }
  recent.push(now);
  return { "RateLimit-Limit": String(max), "RateLimit-Remaining": String(max - recent.length), "RateLimit-Reset": String(Math.ceil((WINDOW - (now - recent[0])) / 1000)) };
}

// Runs an AI job when a slot is free. Waits up to 20 seconds in line, then says the server is busy.
export async function slot(fn) {
  if (disabled()) return fn();
  if (state.running >= MAX_RUNNING) {
    await new Promise((resolve, reject) => {
      const entry = { resolve };
      state.waiting.push(entry);
      setTimeout(() => {
        const i = state.waiting.indexOf(entry);
        if (i === -1) return;
        state.waiting.splice(i, 1);
        reject(new HttpError(503, "Lots of people are checking documents right now. Try again in a few seconds.", { "Retry-After": "10" }));
      }, MAX_QUEUE_WAIT);
    });
  } else {
    state.running++;
  }
  try {
    return await fn();
  } finally {
    const next = state.waiting.shift();
    // hand the slot straight to the next in line, or give it back
    if (next) next.resolve();
    else state.running--;
  }
}

function retryHeaders(max, remaining, wait) {
  return { "Retry-After": String(wait), "RateLimit-Limit": String(max), "RateLimit-Remaining": String(remaining), "RateLimit-Reset": String(wait) };
}

function pretty(seconds) {
  if (seconds < 90) return `${seconds} seconds`;
  if (seconds < 90 * 60) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}

export function resetLimits() {
  state.hits.clear();
  state.running = 0;
  state.waiting = [];
}
