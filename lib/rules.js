// Red flags, worked out in plain code from clauses whose quotes were found in the agreement.
// The model never decides what's unfair: it only reads numbers out, and these rules do the maths.
// A rule only fires on a verified clause, so every flag points at a real line on a real page.

export const MTA = "Model Tenancy Act, 2021";

const rupees = (n) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
const months = (n) => `${Number(n.toFixed(1))} month${n === 1 ? "" : "s"}`;

export function flags(clauses) {
  const ok = new Map(clauses.filter((c) => c.check?.status === "verified").map((c) => [c.key, c]));
  const get = (k) => ok.get(k);
  const num = (k) => (Number.isFinite(get(k)?.value) ? get(k).value : null);
  const rent = num("rent");
  const out = [];
  const add = (level, title, detail, keys, law = null) => out.push({ level, title, detail, keys, law });

  const deposit = num("deposit");
  if (rent && deposit) {
    const m = deposit / rent;
    if (m > 2) {
      add(
        "red",
        `Deposit is ${months(m)} of rent`,
        `${rupees(deposit)} is ${months(m)} of rent. The ${MTA} caps the deposit for a home at two months' rent (${rupees(rent * 2)} here), so ${rupees(deposit - rent * 2)} is above that line.`,
        ["deposit", "rent"],
        { act: MTA, section: "11", note: "A model law: each state adopts its own version, so check your state's rules. It's still the fairest number to negotiate from." },
      );
    }
  }

  const painting = get("painting");
  if (painting) {
    const fixed = /irrespective|regardless|whether or not|in any case|in all cases/i.test(painting.quote);
    const amount = num("painting");
    const share = amount && rent ? ` That's ${months(amount / rent)} of rent.` : "";
    if (fixed) add("red", "Painting charge is cut whatever the condition", `${amount ? rupees(amount) : "A fixed sum"} comes off your deposit even if you leave the flat spotless.${share}`, ["painting"]);
    else if (amount) add("amber", "Painting charge comes off the deposit", `${rupees(amount)} for painting and cleaning.${share}`, ["painting"]);
  }

  const refund = num("refund");
  if (refund && refund > 30) {
    add(
      "amber",
      `Deposit comes back after ${refund} days`,
      `You wait ${refund} days for your money after handing over the keys. The ${MTA} expects the deposit to be returned when the owner takes back the flat.`,
      ["refund"],
      { act: MTA, section: "11", note: "Refund at the time of taking vacant possession, after lawful deductions." },
    );
  } else if (!ok.has("refund") && deposit) {
    add("amber", "No date for getting the deposit back", "The agreement doesn't say when the deposit is refunded. Ask for a number of days in writing.", ["deposit"]);
  }

  const nt = num("notice_tenant");
  const no = num("notice_owner");
  if (nt && no && no < nt) {
    add("red", "Notice is one-sided", `You must give ${months(nt)} of notice, but the owner can ask you to leave with ${months(no)}.`, ["notice_tenant", "notice_owner"]);
  }

  const lockin = num("lockin");
  if (lockin && rent && /pay|deduct|forfeit|penalt/i.test(get("lockin").quote + get("lockin").answer)) {
    add("amber", `Leaving early can cost up to ${rupees(lockin * rent)}`, `Lock-in is ${months(lockin)}. Leave in the first month and you owe the rent for the rest of it.`, ["lockin", "rent"]);
  }

  const repairs = get("repairs");
  if (repairs && /structural|seepage|roof|wall|leak/i.test(repairs.quote)) {
    add("red", "You pay for structural repairs", "Seepage and structural work is normally the owner's job, because it's their building. This clause puts it on you.", ["repairs"]);
  }

  const late = num("late_fee");
  if (late && rent && /per day|each day|every day|daily/i.test(get("late_fee").quote)) {
    const monthly = late * 30;
    add("amber", `Late fee is ${rupees(late)} a day`, `Ten days late is ${rupees(late * 10)}. A month late is ${rupees(monthly)}, which is ${Math.round((monthly / rent) * 100)}% of the rent.`, ["late_fee"]);
  }

  const hike = num("hike");
  if (hike && rent) {
    add("info", `Rent goes up ${hike}% on renewal`, `${rupees(rent)} becomes ${rupees(rent * (1 + hike / 100))} a month.`, ["hike", "rent"]);
  }

  const order = { red: 0, amber: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

// The money a tenant has tied up or can lose, for the summary at the top.
export function atStake(clauses) {
  const ok = new Map(clauses.filter((c) => c.check?.status === "verified").map((c) => [c.key, c.value]));
  const rent = ok.get("rent");
  const deposit = ok.get("deposit");
  if (!rent || !deposit) return null;
  return {
    rent,
    deposit,
    depositMonths: deposit / rent,
    fixedDeductions: Number.isFinite(ok.get("painting")) ? ok.get("painting") : 0,
    refundDays: Number.isFinite(ok.get("refund")) ? ok.get("refund") : null,
    fairDeposit: rent * 2,
  };
}
