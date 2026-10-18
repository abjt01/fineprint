// Trap alarms: the dates on which a contract quietly costs you money, worked out in code from verified
// clauses and exported as a calendar file. "Give notice by 31 Jul" is worth more than a summary.
import { addDays, addMonths, findDates } from "./dates.js";
import { normalise } from "./verify.js";
import { rupees } from "./packs/util.js";

// Dates written in a clause's quote, or just after it on the same page (agreements often put the
// period in one sentence and the dates in the next).
function datesNear(clause, pages) {
  const inQuote = findDates(clause.quote);
  if (inQuote.length || !pages) return inQuote.sort();
  const page = normalise(pages[clause.check.page - 1] || "");
  const at = page.indexOf(normalise(clause.quote).slice(0, 40));
  return at === -1 ? [] : findDates(page.slice(at, at + clause.quote.length + 300)).sort();
}

export function alarms(receipt, pages = null) {
  const ok = new Map(receipt.clauses.filter((c) => c.check?.status === "verified").map((c) => [c.key, c]));
  const num = (k) => (Number.isFinite(ok.get(k)?.value) ? ok.get(k).value : null);
  const term = ok.get("term");
  if (!term) return [];
  const dates = datesNear(term, pages);
  if (!dates.length) return [];

  const start = dates[0];
  const length = num("term");
  const end = dates.length > 1 ? dates.at(-1) : length ? addDays(addMonths(start, length), -1) : null;
  const src = (k) => ({ key: k, page: ok.get(k)?.check.page });
  const out = [];
  const add = (date, title, detail, from) => date && out.push({ date, title, detail, from });

  if (receipt.pack === "rent") {
    const rent = num("rent");
    const lockin = num("lockin");
    if (lockin) add(addMonths(start, lockin), "Lock-in ends", `From today you can leave by giving notice, instead of paying the rest of the lock-in${rent ? ` (up to ${rupees(rent * lockin)})` : ""}.`, [src("lockin"), src("term")]);
    const notice = num("notice_tenant");
    if (end && notice) add(addMonths(addDays(end, 1), -notice), "Last day to give notice", `If you're moving out when the agreement ends on ${end}, give written notice today. Miss it and you owe ${notice} more month${notice === 1 ? "" : "s"} of rent.`, [src("notice_tenant"), src("term")]);
    const hike = num("hike");
    if (end) add(addDays(end, -30), "Agreement ends in 30 days", hike && rent ? `Renewal means rent goes up ${hike}%, to ${rupees(rent * (1 + hike / 100))}. Negotiate now, not on the last day.` : "Decide now whether to renew or move.", [src("term"), ...(hike ? [src("hike")] : [])]);
    const refund = num("refund");
    if (end && refund) add(addDays(end, refund), "Deposit refund is due", `If you handed over the keys on ${end}, the deposit${num("deposit") ? ` (${rupees(num("deposit"))} less agreed deductions)` : ""} should be in your account by today.`, [src("refund"), src("term")]);
    const due = /(\d{1,2})(?:st|nd|rd|th)\s+(?:day\s+)?of\s+(?:every|each)/i.exec(ok.get("rent")?.quote || "") || /(\d{1,2})(?:st|nd|rd|th)\s+day/i.exec(ok.get("rent")?.quote || "");
    if (due && end) out.push({ date: start, until: end, monthlyDay: Math.max(1, Number(due[1]) - 1), title: "Rent due tomorrow", detail: `Rent${rent ? ` of ${rupees(rent)}` : ""} is due by the ${due[1]}th.${num("late_fee") ? ` Late fee is ${rupees(num("late_fee"))}.` : ""}`, from: [src("rent"), ...(ok.has("late_fee") ? [src("late_fee")] : [])] });
  } else if (end) {
    add(end, "Contract ends", "Check what happens next: renewal, a new price, or nothing.", [src("term")]);
    if (ok.has("auto_renew")) add(addDays(end, -7), "Cancel now or it renews", "It renews on its own. If you don't want it, cancel today.", [src("auto_renew"), src("term")]);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
