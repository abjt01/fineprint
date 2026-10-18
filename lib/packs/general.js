// Anything else people sign or click "I agree" on: gym and school contracts, broadband, app terms, vendor deals.
import { collector, rupees, verified } from "./util.js";

export default {
  id: "general",
  name: "Any contract / T&C",
  blurb: "What you pay, auto-renewal, how to cancel, data sharing, disputes",
  keywords: [],
  questions: ["How do I cancel?", "Will they share my data with anyone?", "What happens if I pay late?"],
  clauses: [
    { key: "cost", label: "What you pay", unit: "rs", group: "money", hint: "total price, fee or charges you pay" },
    { key: "recurring", label: "Recurring charge", unit: "rs", group: "money", hint: "monthly or yearly recurring fee or subscription" },
    { key: "penalty", label: "Penalties and late fees", unit: "rs", group: "money", hint: "penalty, late fee or fine" },
    { key: "cancel_fee", label: "Cancellation fee", unit: "rs", group: "money", hint: "fee to cancel or exit early" },
    { key: "refund", label: "Refunds", unit: null, group: "money", hint: "refund policy and whether fees are non-refundable" },
    { key: "term", label: "How long it lasts", unit: "months", group: "terms", hint: "duration, term or lock-in" },
    { key: "auto_renew", label: "Auto-renewal", unit: null, group: "terms", hint: "automatic renewal or auto-debit" },
    { key: "cancel", label: "How to cancel", unit: null, group: "terms", hint: "how and when you can cancel or terminate" },
    { key: "data", label: "Your data", unit: null, group: "terms", hint: "sharing personal data with third parties, marketing" },
    { key: "liability", label: "What they're not responsible for", unit: null, group: "terms", hint: "limitation of liability, waiver, indemnity by you" },
    { key: "dispute", label: "Disputes", unit: null, group: "terms", hint: "arbitration, jurisdiction, governing law" },
    { key: "changes", label: "Changes to the terms", unit: null, group: "terms", hint: "whether they can change terms or prices without consent" },
  ],

  flags(clauses) {
    const v = verified(clauses);
    const { add, done } = collector();
    if (v.has("auto_renew")) add("amber", "It renews on its own", "Unless you cancel in time, you're charged again. Put the cancel-by date in your calendar.", ["auto_renew"]);
    if (/non[- ]?refundable|no refund|not be refunded/i.test(v.text("refund"))) add("red", "Money paid is non-refundable", "If you stop using it, you don't get anything back.", ["refund"]);
    if (v.num("cancel_fee")) add("amber", `Cancelling costs ${rupees(v.num("cancel_fee"))}`, "Count this in before you sign.", ["cancel_fee"]);
    if (!v.has("cancel")) add("amber", "No clear way to cancel", "The document doesn't say how to get out of it. Ask for it in writing.", []);
    if (/third part|share|partner|affiliate|marketing/i.test(v.text("data"))) add("amber", "Your data can be shared", "They can pass your details to other companies. Look for a way to opt out.", ["data"]);
    if (/indemn|waive|not be liable|no liability|at your own risk/i.test(v.text("liability"))) add("amber", "You take on the risk", "They limit what they're responsible for, or you agree to cover their losses.", ["liability"]);
    if (/without (prior )?(notice|consent)|at (its|their) (sole )?discretion|any time/i.test(v.text("changes"))) add("amber", "They can change the terms on their own", "Prices or rules can change after you sign.", ["changes"]);
    if (/arbitrat/i.test(v.text("dispute"))) add("info", "Disputes go to arbitration", "A private arbitrator decides instead of a consumer forum or court first. Note where it would be held.", ["dispute"]);
    return done();
  },

  summary(clauses) {
    const v = verified(clauses);
    const tiles = [];
    if (v.num("cost")) tiles.push({ label: "You pay", value: rupees(v.num("cost")), sub: "as written" });
    if (v.num("recurring")) tiles.push({ label: "Recurring", value: rupees(v.num("recurring")), sub: v.has("auto_renew") ? "renews on its own" : "per period" });
    if (v.num("cancel_fee")) tiles.push({ label: "To get out", value: rupees(v.num("cancel_fee")), sub: "cancellation fee" });
    return tiles;
  },
};
