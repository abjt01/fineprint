import { ask, factcheck } from "@/lib/ask";
import { recall } from "@/lib/docs";
import { readBody, route, text } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

// { doc, question } asks the document; { doc, check } fact-checks text someone else's AI wrote about it
export const POST = route(async (req) => {
  const body = await readBody(req);
  const doc = recall(body.doc);
  const opts = { enclave: body.enclave !== false };
  if (body.check !== undefined) return Response.json(await factcheck(doc, text(body.check, { label: "The text to check", max: 6000, min: 20 }), opts));
  return Response.json(await ask(doc, text(body.question, { label: "The question", max: 300, min: 4 }), opts));
}, { limit: "ask", ai: true });
