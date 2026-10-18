import { readFile } from "node:fs/promises";
import path from "node:path";
import { compare } from "@/lib/diff";
import { HttpError, rateLimit, route } from "@/lib/http";
import { detect } from "@/lib/packs/index";
import { MAX_PDF_BYTES, pdfPages } from "@/lib/pdf";

export const runtime = "nodejs";

async function pdfFrom(form, name, sample) {
  if (form.get("sample")) return readFile(path.join(process.cwd(), "public", sample));
  const file = form.get(name);
  if (!file || typeof file === "string") throw new HttpError(400, "Choose both PDFs: the draft you agreed to and the copy you're asked to sign.");
  if (file.size > MAX_PDF_BYTES) throw new HttpError(413, "That PDF is bigger than 20 MB.");
  return Buffer.from(await file.arrayBuffer());
}

// Two PDFs in, every difference out. No model is called here.
export const POST = route(async (req) => {
  rateLimit(req, "compare", 30, 10 * 60_000);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Send the two PDFs.");
  });
  const before = await pdfPages(await pdfFrom(form, "before", "bengaluru-rent-agreement-draft.pdf"));
  const after = await pdfPages(await pdfFrom(form, "after", "bengaluru-rent-agreement.pdf"));
  const pack = detect(after);
  return Response.json({ pack: { id: pack.id, name: pack.name }, pages: { before: before.length, after: after.length }, changes: compare(before, after, pack) });
});
