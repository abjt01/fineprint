// Which pack fits a document is decided by plain keyword counts, so it's instant and explainable.
// The user can always switch packs on screen.
import general from "./general.js";
import insurance from "./insurance.js";
import job from "./job.js";
import loan from "./loan.js";
import rent from "./rent.js";

export const PACKS = [rent, job, loan, insurance, general];

export const getPack = (id) => PACKS.find((p) => p.id === id) || null;

export function detect(pages) {
  const text = pages.join("\n").toLowerCase();
  let best = { pack: general, score: 0 };
  for (const pack of PACKS) {
    let score = 0;
    for (const k of pack.keywords) {
      const hits = text.split(k).length - 1;
      score += Math.min(hits, 8);
    }
    if (score > best.score) best = { pack, score };
  }
  return best.score >= 6 ? best.pack : general;
}
