import { HttpError, rateLimit, route } from "@/lib/http";
import { MAX_PDF_BYTES, pdfPages } from "@/lib/pdf";
import { verifyReceipt } from "@/lib/receipt";

export const runtime = "nodejs";

// Checks a receipt someone hands you. Nothing here calls a model: it's hashes, string search and signatures.
export const POST = route(async (req) => {
  rateLimit(req, "verify", 60, 10 * 60_000);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Send the receipt file.");
  });
  const raw = form.get("receipt");
  const text = typeof raw === "string" ? raw : raw ? await raw.text() : "";
  if (!text.trim()) throw new HttpError(400, "Choose the receipt (.json) first.");
  if (text.length > 2 * 1024 * 1024) throw new HttpError(413, "That receipt is too big.");
  let receipt;
  try {
    receipt = JSON.parse(text);
  } catch {
    throw new HttpError(400, "That receipt isn't valid JSON.");
  }

  const file = form.get("file");
  let bytes = null;
  let pages = null;
  if (file && typeof file !== "string" && file.size) {
    if (file.size > MAX_PDF_BYTES) throw new HttpError(413, "That PDF is bigger than 20 MB.");
    bytes = Buffer.from(await file.arrayBuffer());
    pages = await pdfPages(bytes);
  }
  return Response.json(verifyReceipt(receipt, { bytes, pages }));
});
