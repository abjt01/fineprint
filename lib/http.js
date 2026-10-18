export class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

// Wraps a route handler so thrown HttpErrors become JSON responses. With `limit`, the route is
// rate limited (see ratelimit.js); with `ai`, it also waits for a free slot among the running AI jobs.
export function route(fn, { limit: name = null, ai = false } = {}) {
  return async (req, ctx) => {
    try {
      const { limit, slot } = await import("./ratelimit.js");
      const headers = name ? limit(req, name) : {};
      const res = ai ? await slot(() => fn(req, ctx)) : await fn(req, ctx);
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    } catch (err) {
      if (err instanceof HttpError) {
        const retry = Number(err.headers?.["Retry-After"]) || undefined;
        return Response.json({ error: err.message, retryAfter: retry }, { status: err.status, headers: err.headers });
      }
      console.error(err);
      return Response.json({ error: "Something went wrong. Try that again." }, { status: 500 });
    }
  };
}

export async function readBody(req) {
  const raw = await req.text();
  if (raw.length > 64 * 1024) throw new HttpError(413, "That request is too big.");
  if (!raw.trim()) return {};
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "That request didn't make sense.");
  }
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

export function creds(req) {
  const q = new URL(req.url).searchParams;
  return { k: q.get("k") || "", p: q.get("p") || "" };
}

export function text(value, { label, max, min = 0 }) {
  const s = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (s.length < min) throw new HttpError(400, min > 1 ? `${label} is too short.` : `${label} is required.`);
  if (s.length > max) throw new HttpError(400, `${label} is too long (max ${max} characters).`);
  return s;
}
