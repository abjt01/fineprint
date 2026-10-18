import { HttpError, route, text } from "@/lib/http";
import { settle } from "@/lib/settle";

export const runtime = "nodejs";
export const maxDuration = 60;

// { receipt, message }: the receipt saved at signing, and the message listing what's being deducted
export const POST = route(async (req) => {
  const raw = await req.text();
  if (raw.length > 2 * 1024 * 1024) throw new HttpError(413, "That request is too big.");
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "That request didn't make sense.");
  }
  let receipt = body?.receipt;
  if (typeof receipt === "string") {
    try {
      receipt = JSON.parse(receipt);
    } catch {
      throw new HttpError(400, "That receipt isn't valid JSON.");
    }
  }
  return Response.json(await settle(receipt, text(body?.message, { label: "The message", max: 3000, min: 10 })));
}, { limit: "settle", ai: true });
