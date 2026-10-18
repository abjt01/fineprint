// Personal loans, consumer loans, BNPL and credit lines. The maths here is the point:
// code works out the EMI from the written rate, and the rate from the written EMI, and says when they disagree.
import { collector, rupees, verified } from "./util.js";

export function emi(principal, annualRate, n) {
  const i = annualRate / 1200;
  if (!i) return principal / n;
  const f = (1 + i) ** n;
  return (principal * i * f) / (f - 1);
}

// The yearly rate that makes this EMI pay off this principal in n months (bisection, good to 0.01%).
export function impliedRate(principal, payment, n) {
  if (payment * n <= principal) return 0;
  let lo = 0;
  let hi = 200;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (emi(principal, mid, n) > payment) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export default {
  id: "loan",
  name: "Loan / EMI",
  blurb: "Real interest rate, total interest, foreclosure, hidden charges",
  keywords: ["loan", "borrower", "lender", "emi", "equated monthly", "interest rate", "sanction", "tenure", "foreclosure", "prepayment", "nbfc", "repayment", "credit"],
  questions: ["Can I close the loan early, and what does it cost?", "What happens if an EMI bounces?", "Is the insurance optional?"],
  clauses: [
    { key: "principal", label: "Loan amount", unit: "rs", group: "money", hint: "sanctioned or disbursed loan amount, principal" },
    { key: "rate", label: "Interest rate (per year)", unit: "percent", group: "money", hint: "rate of interest per annum, and whether fixed or floating, flat or reducing" },
    { key: "tenure", label: "Tenure", unit: "months", group: "money", hint: "loan tenure / repayment period in months" },
    { key: "emi", label: "EMI", unit: "rs", group: "money", hint: "monthly instalment amount" },
    { key: "processing_fee", label: "Processing fee", unit: "rs", group: "money", hint: "processing, documentation or login fee, as an amount" },
    { key: "insurance", label: "Insurance added to the loan", unit: "rs", group: "money", hint: "insurance premium bundled or deducted from the loan" },
    { key: "foreclosure", label: "Foreclosure / prepayment charge", unit: "percent", group: "terms", hint: "charge for closing early or part prepayment, percent" },
    { key: "late_fee", label: "Late payment charge", unit: "rs", group: "terms", hint: "late payment fee or penal charges per instalment" },
    { key: "penal_rate", label: "Penal interest", unit: "percent", group: "terms", hint: "extra interest per annum on overdue amounts" },
    { key: "bounce", label: "Bounce charge", unit: "rs", group: "terms", hint: "cheque, ECS, NACH or auto-debit bounce charge" },
    { key: "recovery", label: "Recovery and collection", unit: null, group: "terms", hint: "what the lender can do on default: recovery agents, contacting references, seizing" },
  ],

  flags(clauses, pages = null) {
    const v = verified(clauses, pages);
    const { add, done } = collector();
    const P = v.num("principal");
    const r = v.num("rate");
    const n = v.num("tenure");
    const written = v.num("emi");

    // fees taken out of the disbursal shrink what you actually get, so the rate on the money in hand is higher still
    const upfront = ["processing_fee", "insurance"].filter((k) => v.num(k) && /deduct|disburs|upfront|net of/i.test(v.text(k))).reduce((a, k) => a + v.num(k), 0);
    if (P && n && written) {
      const real = impliedRate(P, written, n);
      if (r && real > r + 1) {
        const inHand = upfront ? ` Counting the ${rupees(upfront)} taken off at disbursal, you get ${rupees(P - upfront)} in hand and the rate on that is ${impliedRate(P - upfront, written, n).toFixed(1)}%.` : "";
        add("red", `The real rate is about ${real.toFixed(1)}% a year, not ${r}%`, `An EMI of ${rupees(written)} for ${n} months on ${rupees(P)} only works out at ${real.toFixed(1)}% on a reducing balance. At ${r}% the EMI would be ${rupees(emi(P, r, n))}. This is what a "flat rate" quote looks like.${inHand}`, ["emi", "rate", "principal", "tenure"]);
      }
      add("info", `You pay ${rupees(written * n - P)} in interest`, `${n} EMIs of ${rupees(written)} add up to ${rupees(written * n)} for a ${rupees(P)} loan.`, ["emi", "tenure", "principal"]);
    } else if (P && r && n) {
      const e = emi(P, r, n);
      add("info", `You pay about ${rupees(e * n - P)} in interest`, `At ${r}% for ${n} months the EMI is about ${rupees(e)}, so you repay ${rupees(e * n)} in all.`, ["rate", "tenure", "principal"]);
    }

    const fee = v.num("processing_fee");
    const ins = v.num("insurance");
    if (P && (fee || ins)) {
      const cut = (fee || 0) + (ins || 0);
      add("amber", `${rupees(cut)} goes before you see the money`, `${fee ? `Processing fee ${rupees(fee)}` : ""}${fee && ins ? " and " : ""}${ins ? `insurance ${rupees(ins)}` : ""}. That's ${((cut / P) * 100).toFixed(1)}% of the loan, and you pay interest on it too if it's added to the principal.${ins ? " Ask whether the insurance is optional." : ""}`, ["processing_fee", "insurance", "principal"]);
    }

    const fc = v.num("foreclosure");
    if (fc) add("amber", `Closing early costs ${fc}%`, `${P ? `On the full ${rupees(P)} that's ${rupees((P * fc) / 100)}. ` : ""}If this is a floating-rate loan to an individual, ask the lender whether the charge applies at all.`, ["foreclosure", "principal"]);

    const pen = v.num("penal_rate");
    if (pen) add("amber", `Missed EMIs cost an extra ${pen}% a year`, "Penal interest is added on top of the normal rate on anything overdue.", ["penal_rate"]);

    const bounce = v.num("bounce");
    const late = v.num("late_fee");
    if (bounce || late) add("amber", "One missed EMI is expensive", `${bounce ? `Bounce charge ${rupees(bounce)}` : ""}${bounce && late ? ", plus " : ""}${late ? `late fee ${rupees(late)}` : ""}, before any penal interest.`, ["bounce", "late_fee"]);

    if (/reference|relative|friend|employer|contact|agent|seiz|repossess/i.test(v.text("recovery"))) {
      add("red", "Recovery can involve people you know", "The agreement lets the lender or its agents contact others or take action on default. Read this line carefully before signing.", ["recovery"]);
    }
    return done();
  },

  summary(clauses) {
    const v = verified(clauses);
    const P = v.num("principal");
    const n = v.num("tenure");
    const pay = v.num("emi") || (P && v.num("rate") && n ? emi(P, v.num("rate"), n) : null);
    if (!P || !n || !pay) return [];
    return [
      { label: "You borrow", value: rupees(P), sub: `${n} months` },
      { label: "You pay back", value: rupees(pay * n), sub: `${rupees(pay)} a month` },
      { label: "Real yearly rate", value: `${impliedRate(P, pay, n).toFixed(1)}%`, sub: "worked out from the EMI, reducing balance" },
    ];
  },
};
