// Job offer letters and appointment letters: the CTC that isn't cash, bonds, notice, non-competes.
import { collector, months, rupees, verified } from "./util.js";

export default {
  id: "job",
  name: "Job offer",
  blurb: "CTC vs in-hand, bonds, notice buyout, non-compete, probation",
  keywords: ["offer letter", "appointment", "employment", "employee", "ctc", "cost to company", "joining", "probation", "designation", "salary", "notice period", "service agreement"],
  questions: ["Can they transfer me to another city?", "What happens to my bonus if I resign?", "How many leaves do I get?"],
  clauses: [
    { key: "ctc", label: "Total CTC (per year)", unit: "rs", group: "money", hint: "annual cost to company / total compensation" },
    { key: "fixed", label: "Fixed pay (per year)", unit: "rs", group: "money", hint: "annual fixed or base salary, guaranteed part" },
    { key: "variable", label: "Variable pay (per year)", unit: "rs", group: "money", hint: "annual variable pay, performance bonus, incentive" },
    { key: "joining_bonus", label: "Joining bonus", unit: "rs", group: "money", hint: "joining or sign-on bonus and when it must be paid back" },
    { key: "bond", label: "Bond / training cost recovery", unit: "rs", group: "money", hint: "service bond, training cost or liquidated damages payable if you leave early" },
    { key: "bond_period", label: "Bond period", unit: "months", group: "money", hint: "minimum service period of the bond" },
    { key: "notice", label: "Notice period", unit: "days", group: "terms", hint: "notice period to resign, in days" },
    { key: "probation", label: "Probation", unit: "months", group: "terms", hint: "probation period and notice during probation" },
    { key: "non_compete", label: "Non-compete after leaving", unit: null, group: "terms", hint: "restriction on joining competitors or clients after leaving" },
    { key: "transfer", label: "Transfer and location", unit: null, group: "terms", hint: "work location and whether you can be transferred or relocated" },
    { key: "leave", label: "Leave per year", unit: "days", group: "terms", hint: "paid leave / earned leave days per year" },
    { key: "termination", label: "How they can let you go", unit: null, group: "terms", hint: "termination by the company, with or without cause, notice or pay in lieu" },
  ],

  flags(clauses, pages = null) {
    const v = verified(clauses, pages);
    const { add, done } = collector();
    const ctc = v.num("ctc");
    const fixed = v.num("fixed");

    const bond = v.num("bond");
    if (bond) {
      const period = v.num("bond_period");
      add("red", `Leaving early costs ${rupees(bond)}`, `You owe ${rupees(bond)} if you leave${period ? ` within ${months(period)}` : " before the bond ends"}.${fixed ? ` That's ${months(bond / (fixed / 12))} of fixed pay.` : ""}`, ["bond", "bond_period"]);
    }

    const notice = v.num("notice");
    if (notice && notice > 30) {
      const buyout = fixed ? ` Buying it out would cost about ${rupees((fixed / 365) * notice)} of fixed pay.` : "";
      add(notice > 60 ? "amber" : "info", `${notice}-day notice period`, `When you resign you serve ${notice} days. A new employer may not wait that long.${buyout}`, ["notice", "fixed"]);
    }

    const variable = v.num("variable");
    const base = ctc || (fixed && variable ? fixed + variable : null);
    if (variable && base) {
      add("amber", `${Math.round((variable / base) * 100)}% of the CTC isn't guaranteed`, `${rupees(variable)} is variable pay that depends on ratings or company results. The guaranteed part is ${fixed ? rupees(fixed) : rupees(base - variable)} a year.`, ["variable", "ctc", "fixed"]);
    }
    if (ctc && fixed && ctc - fixed - (variable || 0) > ctc * 0.05) {
      add("info", `${rupees(ctc - fixed - (variable || 0))} of the CTC is neither salary nor bonus`, "Usually employer PF, gratuity, insurance or one-time payments. It counts in the CTC but doesn't reach your account each month.", ["ctc", "fixed", "variable"]);
    }

    if (v.has("non_compete")) {
      add(
        "amber",
        "Non-compete after you leave",
        "The letter limits where you can work after leaving. Indian courts have generally refused to enforce these after employment ends, but ask for it to be removed or narrowed anyway.",
        ["non_compete"],
        { act: "Indian Contract Act, 1872", section: "27", note: "Agreements in restraint of trade are void, with a narrow exception for selling goodwill." },
      );
    }

    if (v.has("joining_bonus") && /repay|refund|return|recover|claw/i.test(v.text("joining_bonus"))) {
      add("amber", "Joining bonus has to be paid back if you leave", `${v.num("joining_bonus") ? rupees(v.num("joining_bonus")) : "The bonus"} comes back out of your pocket if you leave early.`, ["joining_bonus"]);
    }

    if (/any (location|city|office|place)|anywhere|transfer/i.test(v.text("transfer"))) {
      add("info", "They can move you to another city", "The letter lets the company transfer you. Ask whether relocation is paid for.", ["transfer"]);
    }
    return done();
  },

  summary(clauses) {
    const v = verified(clauses);
    const ctc = v.num("ctc");
    const fixed = v.num("fixed");
    if (!ctc && !fixed) return [];
    const tiles = [];
    if (ctc) tiles.push({ label: "CTC on paper", value: rupees(ctc), sub: "per year" });
    if (fixed) tiles.push({ label: "Guaranteed fixed pay", value: rupees(fixed), sub: `about ${rupees(fixed / 12)} a month before tax` });
    tiles.push({ label: "Costs you to leave early", value: rupees(v.num("bond") || 0), sub: v.num("notice") ? `plus ${v.num("notice")} days' notice` : "bond or recovery" });
    return tiles;
  },
};
