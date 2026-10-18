import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyse } from "@/lib/analyse";
import { HttpError, rateLimit, route } from "@/lib/http";
import { MAX_PDF_BYTES } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

const SAMPLE = "bengaluru-rent-agreement.pdf";

export const POST = route(async (req) => {
  rateLimit(req, "check", 12, 10 * 60_000);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Send the agreement as a PDF file.");
  });
  let bytes;
  let name;
  if (form.get("sample") === "1") {
    bytes = await readFile(path.join(process.cwd(), "public", SAMPLE));
    name = SAMPLE;
  } else {
    const file = form.get("file");
    if (!file || typeof file === "string") throw new HttpError(400, "Choose the agreement PDF first.");
    if (file.size > MAX_PDF_BYTES) throw new HttpError(413, "That PDF is bigger than 20 MB.");
    bytes = Buffer.from(await file.arrayBuffer());
    name = String(file.name || "agreement.pdf").slice(0, 120);
  }
  return Response.json(await analyse(bytes, name));
});
