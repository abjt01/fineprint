// Printed isn't always what was promised. The draft on WhatsApp says a 6-month deposit; the copy on
// stamp paper at the registration desk says 10, and nobody re-reads five pages with a broker waiting.
// This compares the two word by word. No model is involved: every change shown is a real difference
// in the text, with its page in both files, and the numbers that changed pulled out.
import { diffArrays } from "diff";
import { rank } from "./search.js";
import { numbersIn, normalise } from "./verify.js";

// Words with the page each came from, so a change can be pointed at in both files.
function wordsOf(pages) {
  const out = [];
  pages.forEach((p, i) => {
    for (const w of normalise(p).split(" ")) if (w) out.push({ w, page: i + 1 });
  });
  return out;
}

const CONTEXT = 8;

export function compare(before, after, pack) {
  const a = wordsOf(before);
  const b = wordsOf(after);
  const parts = diffArrays(
    a.map((x) => x.w),
    b.map((x) => x.w),
  );

  const changes = [];
  let ia = 0;
  let ib = 0;
  let cur = null;
  const flush = () => {
    if (!cur) return;
    cur.after = b.slice(cur.bStart, ib).map((x) => x.w).join(" ");
    cur.before = a.slice(cur.aStart, ia).map((x) => x.w).join(" ");
    cur.lead = a.slice(Math.max(0, cur.aStart - CONTEXT), cur.aStart).map((x) => x.w).join(" ");
    cur.tail = a.slice(ia, ia + CONTEXT).map((x) => x.w).join(" ");
    cur.pageBefore = a[Math.min(cur.aStart, a.length - 1)]?.page ?? null;
    cur.pageAfter = b[Math.min(cur.bStart, b.length - 1)]?.page ?? null;
    changes.push(cur);
    cur = null;
  };

  for (const part of parts) {
    const n = part.value.length;
    if (!part.added && !part.removed) {
      // a couple of equal words between two edits still reads as one change
      if (cur && n <= 2) {
        ia += n;
        ib += n;
        continue;
      }
      flush();
      ia += n;
      ib += n;
      continue;
    }
    if (!cur) cur = { aStart: ia, bStart: ib };
    if (part.removed) ia += n;
    else ib += n;
  }
  flush();

  const clauses = pack?.clauses || [];
  return changes
    .filter((c) => c.before || c.after)
    .map((c, i) => {
      const was = [...numbersIn(c.before)];
      const now = [...numbersIn(c.after)];
      const around = `${c.lead} ${c.before} ${c.after} ${c.tail}`;
      const best = clauses.length ? rank(clauses.map((x) => ({ ...x, text: `${x.label} ${x.hint}` })), around)[0] : null;
      return {
        id: i + 1,
        clause: best ? { key: best.key, label: best.label } : null,
        before: c.before,
        after: c.after,
        lead: c.lead,
        tail: c.tail,
        pageBefore: c.pageBefore,
        pageAfter: c.pageAfter,
        numbers: was.length || now.length ? { was, now } : null,
        kind: !c.before ? "added" : !c.after ? "removed" : "changed",
      };
    });
}
