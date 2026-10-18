// npm run keys: checks every Groq key in the pool against Groq and says which ones to replace.
// Prints only the last four characters of each key.
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env, use the environment as it is
}

const keys = [...new Set([process.env.GROQ_API_KEY, ...String(process.env.GROQ_API_KEYS || "").split(",")].map((k) => String(k || "").trim()).filter(Boolean))];
if (!keys.length) {
  console.log("No Groq keys set. Put them in GROQ_API_KEY and GROQ_API_KEYS (comma-separated).");
  process.exit(1);
}

let bad = 0;
for (const key of keys) {
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } }).catch((err) => ({ ok: false, status: err.message }));
  const models = res.ok ? (await res.json()).data.map((m) => m.id) : [];
  const has = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].filter((m) => models.includes(m)).length;
  if (!res.ok) bad++;
  console.log(`…${key.slice(-4)}  ${res.ok ? `ok, ${has}/3 models this app uses` : `REPLACE (${res.status})`}`);
}
console.log(`${keys.length - bad} of ${keys.length} keys work.`);
process.exit(bad ? 1 : 0);
