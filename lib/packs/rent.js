// Residential rent agreements, the 11-month kind brokers print on stamp paper.
import { collector, months, rupees, verified } from "./util.js";

const MTA = "Model Tenancy Act, 2021";

export default {
  id: "rent",
  name: "Rent agreement",
  blurb: "Deposit, lock-in, painting cuts, notice, refund time, repairs",
  keywords: ["tenant", "landlord", "lessor", "lessee", "rent", "security deposit", "premises", "lock-in", "tenancy", "owner"],
  questions: ["Can the owner enter the flat without telling me?", "What happens if I leave before the lock-in ends?", "Who pays for a broken geyser?"],
  clauses: [
    { key: "rent", label: "Monthly rent", unit: "rs", group: "money", hint: "monthly rent amount" },
    { key: "deposit", label: "Security deposit", unit: "rs", group: "money", hint: "security deposit / advance amount" },
    { key: "maintenance", label: "Maintenance charges", unit: "rs", group: "money", hint: "monthly maintenance or society charges, and who pays" },
    { key: "late_fee", label: "Late payment fee", unit: "rs", group: "money", hint: "penalty or late fee for paying rent late" },
    { key: "hike", label: "Rent increase", unit: "percent", group: "money", hint: "rent enhancement or escalation percent and when" },
    { key: "painting", label: "Painting / cleaning deduction", unit: "rs", group: "money", hint: "painting or cleaning charges deducted from the deposit" },
    { key: "refund", label: "Deposit refund time", unit: "days", group: "money", hint: "how many days after vacating the deposit is returned" },
    { key: "term", label: "Agreement period", unit: "months", group: "terms", hint: "length of the tenancy and start date" },
    { key: "lockin", label: "Lock-in period", unit: "months", group: "terms", hint: "lock-in period and penalty for leaving early" },
    { key: "notice_tenant", label: "Notice the tenant must give", unit: "months", group: "terms", hint: "notice period the tenant gives before vacating" },
    { key: "notice_owner", label: "Notice the owner must give", unit: "months", group: "terms", hint: "notice period the owner/landlord gives to end the tenancy" },
    { key: "repairs", label: "Who pays for repairs", unit: null, group: "terms", hint: "who bears repairs: plumbing, electrical, structural, seepage" },
    { key: "electricity", label: "Electricity rate", unit: "rs", group: "terms", hint: "electricity charges per unit or sub-meter" },
    { key: "restrictions", label: "House rules", unit: null, group: "terms", hint: "restrictions on pets, guests, food, visitors, use" },
  ],

  flags(clauses, pages = null) {
    const v = verified(clauses, pages);
    const { add, done } = collector();
    const rent = v.num("rent");

    const deposit = v.num("deposit");
    if (rent && deposit && deposit / rent > 2) {
      const m = deposit / rent;
      add(
        "red",
        `Deposit is ${months(m)} of rent`,
        `${rupees(deposit)} is ${months(m)} of rent. The ${MTA} caps the deposit for a home at two months' rent (${rupees(rent * 2)} here), so ${rupees(deposit - rent * 2)} is above that line.`,
        ["deposit", "rent"],
        { act: MTA, section: "11", note: "A model law: each state adopts its own version, so check your state's rules. It's still the fairest number to negotiate from." },
      );
    }

    if (v.has("painting")) {
      const fixed = /irrespective|regardless|whether or not|in any case|in all cases/i.test(v.text("painting"));
      const amount = v.num("painting");
      const share = amount && rent ? ` That's ${months(amount / rent)} of rent.` : "";
      if (fixed) add("red", "Painting charge is cut whatever the condition", `${amount ? rupees(amount) : "A fixed sum"} comes off your deposit even if you leave the flat spotless.${share}`, ["painting"]);
      else if (amount) add("amber", "Painting charge comes off the deposit", `${rupees(amount)} for painting and cleaning.${share}`, ["painting"]);
    }

    const refund = v.num("refund");
    if (refund && refund > 30) {
      add(
        "amber",
        `Deposit comes back after ${refund} days`,
        `You wait ${refund} days for your money after handing over the keys. The ${MTA} expects the deposit to be returned when the owner takes back the flat.`,
        ["refund"],
        { act: MTA, section: "11", note: "Refund at the time of taking vacant possession, after lawful deductions." },
      );
    } else if (!v.has("refund") && deposit) {
      add("amber", "No date for getting the deposit back", "The agreement doesn't say when the deposit is refunded. Ask for a number of days in writing.", ["deposit"]);
    }

    const nt = v.num("notice_tenant");
    const no = v.num("notice_owner");
    if (nt && no && no < nt) add("red", "Notice is one-sided", `You must give ${months(nt)} of notice, but the owner can ask you to leave with ${months(no)}.`, ["notice_tenant", "notice_owner"]);

    const lockin = v.num("lockin");
    if (lockin && rent && /pay|deduct|forfeit|penalt/i.test(v.text("lockin"))) {
      add("amber", `Leaving early can cost up to ${rupees(lockin * rent)}`, `Lock-in is ${months(lockin)}. Leave in the first month and you owe the rent for the rest of it.`, ["lockin", "rent"]);
    }

    if (/structural|seepage|roof|wall|leak/i.test(v.text("repairs"))) {
      add("red", "You pay for structural repairs", "Seepage and structural work is normally the owner's job, because it's their building. This clause puts it on you.", ["repairs"]);
    }

    const late = v.num("late_fee");
    if (late && rent && /per day|each day|every day|daily/i.test(v.text("late_fee"))) {
      add("amber", `Late fee is ${rupees(late)} a day`, `Ten days late is ${rupees(late * 10)}. A month late is ${rupees(late * 30)}, which is ${Math.round(((late * 30) / rent) * 100)}% of the rent.`, ["late_fee"]);
    }

    const hike = v.num("hike");
    if (hike && rent) add("info", `Rent goes up ${hike}% on renewal`, `${rupees(rent)} becomes ${rupees(rent * (1 + hike / 100))} a month.`, ["hike", "rent"]);

    return done();
  },

  summary(clauses) {
    const v = verified(clauses);
    const rent = v.num("rent");
    const deposit = v.num("deposit");
    if (!rent || !deposit) return [];
    return [
      { label: "Deposit", value: rupees(deposit), sub: `${Number((deposit / rent).toFixed(1))} months of rent` },
      { label: "Fair under the Model Tenancy Act", value: rupees(rent * 2), sub: "two months of rent" },
      { label: "Cut no matter what", value: rupees(v.num("painting") || 0), sub: v.num("refund") ? `back after ${v.num("refund")} days` : "no refund date given" },
    ];
  },
};
