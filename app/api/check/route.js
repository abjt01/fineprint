import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyse } from "@/lib/analyse";
import { HttpError, rateLimit, route } from "@/lib/http";
import { MAX_PDF_BYTES } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

const SAMPLES = { rent: "bengaluru-rent-agreement.pdf", job: "sample-offer-letter.pdf", loan: "sample-loan-agreement.pdf" };

export const POST = route(async (req) => {
  rateLimit(req, "check", 12, 10 * 60_000);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Send the document as a PDF file.");
  });
  let bytes;
  let name;
  const sample = form.get("sample");
  if (sample) {
    name = SAMPLES[sample] || SAMPLES.rent;
    bytes = await readFile(path.join(process.cwd(), "public", name));
  } else {
    const file = form.get("file");
    if (!file || typeof file === "string") throw new HttpError(400, "Choose the PDF first.");
    if (file.size > MAX_PDF_BYTES) throw new HttpError(413, "That PDF is bigger than 20 MB.");
    bytes = Buffer.from(await file.arrayBuffer());
    name = String(file.name || "agreement.pdf").slice(0, 120);
  }
  const pack = typeof form.get("pack") === "string" ? form.get("pack") : null;
  return Response.json(await analyse(bytes, name, pack, { enclave: form.get("enclave") !== "0" }));
});
