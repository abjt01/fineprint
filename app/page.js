import Link from "next/link";
import Checker from "@/components/Checker";

const MOMENTS = [
  { n: "1", when: "Before you sign", what: "Every clause that costs money, with its line. Flags worked out in code.", href: "#review" },
  { n: "2", when: "At the signing desk", what: "Draft on WhatsApp vs the printed copy. Every changed word, no AI.", href: "/compare" },
  { n: "3", when: "While you live with it", what: "Trap alarms in your calendar: notice deadlines, lock-in, renewal, refund due.", href: "#review" },
  { n: "4", when: "Money day", what: "Paste their deductions. Each line checked against your receipt, reply ready.", href: "/settle" },
];

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <p className="eyebrow">AI with receipts</p>
        <h1>Every AI can read your contract. Receipts stays until your money comes back.</h1>
        <p className="lede">
          Rent agreements, offer letters, loans, insurance, any terms you sign. Everything it tells you is quoted from the PDF and checked in
          code, a second model audits it, and you keep a receipt anyone can verify. Then it&apos;s there on the days the contract costs you
          money.
        </p>
      </section>
      <ol className="moments">
        {MOMENTS.map((m) => (
          <li key={m.n}>
            <Link href={m.href}>
              <span className="moment-n">{m.n}</span>
              <strong>{m.when}</strong>
              <span>{m.what}</span>
            </Link>
          </li>
        ))}
      </ol>
      <Checker />
    </main>
  );
}
