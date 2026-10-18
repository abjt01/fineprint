// Health insurance policy wordings: the parts that decide how much of a hospital bill you pay yourself.
import { collector, months, rupees, verified } from "./util.js";

export default {
  id: "insurance",
  name: "Health insurance",
  blurb: "Co-pay, room-rent cap, waiting periods, sub-limits, exclusions",
  keywords: ["policy", "insured", "sum insured", "premium", "claim", "hospitalisation", "hospitalization", "waiting period", "co-payment", "copay", "exclusion", "insurer", "cashless", "pre-existing"],
  questions: ["Is cataract surgery covered?", "How soon must I tell them about a hospital stay?", "Are my parents covered?"],
  clauses: [
    { key: "sum_insured", label: "Sum insured", unit: "rs", group: "money", hint: "sum insured / cover amount per year" },
    { key: "premium", label: "Premium", unit: "rs", group: "money", hint: "annual premium amount" },
    { key: "copay", label: "Co-payment", unit: "percent", group: "money", hint: "co-payment percent of each claim the insured pays" },
    { key: "deductible", label: "Deductible", unit: "rs", group: "money", hint: "deductible amount the insured pays before cover starts" },
    { key: "room_rent", label: "Room rent limit", unit: "rs", group: "money", hint: "room rent cap per day, or as percent of sum insured, and proportionate deduction" },
    { key: "ped_wait", label: "Waiting period: existing illnesses", unit: "months", group: "terms", hint: "waiting period for pre-existing diseases" },
    { key: "initial_wait", label: "Initial waiting period", unit: "days", group: "terms", hint: "initial waiting period from policy start, except accidents" },
    { key: "specific_wait", label: "Waiting period: listed illnesses", unit: "months", group: "terms", hint: "specific diseases or procedures waiting period (cataract, hernia, joint replacement)" },
    { key: "sublimits", label: "Sub-limits", unit: null, group: "terms", hint: "caps on specific treatments or illnesses below the sum insured" },
    { key: "exclusions", label: "Main exclusions", unit: null, group: "terms", hint: "permanent exclusions: what is never covered" },
    { key: "claim_notice", label: "When to tell the insurer", unit: null, group: "terms", hint: "time limit to intimate a claim or planned hospitalisation" },
  ],

  flags(clauses) {
    const v = verified(clauses);
    const { add, done } = collector();
    const si = v.num("sum_insured");

    const copay = v.num("copay");
    if (copay) {
      const bill = si ? Math.min(si, 500000) : 500000;
      add("red", `You pay ${copay}% of every claim`, `On a ${rupees(bill)} hospital bill you pay ${rupees((bill * copay) / 100)} yourself, every time.`, ["copay", "sum_insured"]);
    }

    if (v.has("room_rent")) {
      const prop = /proportion/i.test(v.text("room_rent"));
      add(prop ? "red" : "amber", "Room rent is capped", prop ? "Take a room above the cap and the policy cuts the rest of the bill (doctor, tests, surgery) in the same ratio. This is often the biggest surprise at discharge." : "Choose a room above the cap and you pay the difference.", ["room_rent"]);
    }

    const ded = v.num("deductible");
    if (ded) add("amber", `First ${rupees(ded)} is on you`, "The deductible is paid by you before the policy pays anything.", ["deductible"]);

    const ped = v.num("ped_wait");
    if (ped) add(ped > 24 ? "amber" : "info", `Existing illnesses wait ${months(ped)}`, `Diabetes, BP or anything you already had isn't covered until ${months(ped)} (${Number((ped / 12).toFixed(1))} years) after you start.`, ["ped_wait"]);

    const sw = v.num("specific_wait");
    if (sw) add("info", `Listed illnesses wait ${months(sw)}`, "Common planned surgeries in the policy's list aren't covered until then.", ["specific_wait"]);

    if (v.has("sublimits")) add("amber", "Some treatments have their own cap", "Even with a big sum insured, these treatments are paid only up to the sub-limit.", ["sublimits"]);
    return done();
  },

  summary(clauses) {
    const v = verified(clauses);
    const si = v.num("sum_insured");
    if (!si) return [];
    return [
      { label: "Cover", value: rupees(si), sub: v.num("premium") ? `for ${rupees(v.num("premium"))} a year` : "per year" },
      { label: "You pay per claim", value: `${v.num("copay") || 0}%`, sub: v.num("deductible") ? `after a ${rupees(v.num("deductible"))} deductible` : "co-payment" },
      { label: "Existing illnesses covered after", value: v.num("ped_wait") ? months(v.num("ped_wait")) : "not stated", sub: "waiting period" },
    ];
  },
};
