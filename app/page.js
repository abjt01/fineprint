import Link from "next/link";
import Checker from "@/components/Checker";
import { teeConfig } from "@/lib/llm";

const MOMENTS = [
  { n: "1", when: "Before you sign", what: "Every clause that costs money, with its line and page. Flags worked out in code.", href: "#review", tag: "AI + code" },
  { n: "2", when: "At the signing desk", what: "The WhatsApp draft vs the stamp-paper copy. Every changed word, with pages.", href: "/compare", tag: "no AI" },
  { n: "3", when: "While you live with it", what: "Trap alarms in your calendar: notice deadline, lock-in, renewal, refund due.", href: "#review", tag: "code" },
  { n: "4", when: "Money day", what: "Paste their deductions. Each line checked against your receipt, reply ready.", href: "/settle", tag: "AI + code" },
];

// The receipt in the hero shows real output for the sample agreement in public/.
const LINES = [
  ["Deposit", "3,20,000", "p.1"],
  ["Fair (MTA §11)", "64,000", null],
  ["Painting, any condition", "32,000", "p.2"],
  ["Your notice / owner's", "2 mo / 1 mo", "p.2"],
  ["Refund wait", "60 days", "p.2"],
];

function Till() {
  return (
    <div className="till" aria-label="Example receipt for the sample rent agreement">
      <div className="till-paper">
        <div className="till-head">
          <strong>RECEIPTS</strong>
          bengaluru-rent-agreement.pdf
          <br />3 pages · 14 of 14 quotes found
        </div>
        {LINES.map(([label, amt, page]) => (
          <div className="till-row" key={label}>
            <span>{label}</span>
            <span className="dots" />
            <span className="amt">{amt}</span>
            {page && <span className="pg">✓ {page}</span>}
          </div>
        ))}
        <div className="till-total">
          <span>ABOVE THE LINE</span>
          <span className="amt">Rs. 2,56,000</span>
        </div>
        <div className="barcode" aria-hidden="true" />
        <div className="till-foot">sha256 digest · verify it without any AI</div>
        <span className="rubber ok">Verified in code</span>
        <span className="rubber bad">10 months!</span>
      </div>
      <p className="till-note">From the sample agreement. Try it below.</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero-grid">
        <div>
          <p className="eyebrow">Open-weight AI · checked in code</p>
          <h1>
            Every AI can read your contract. Receipts stays until <span className="hl">your money comes back.</span>
          </h1>
          <p className="lede">
            Rent agreements, offer letters, loans, insurance, any terms you sign. Every answer is quoted from your PDF and checked by code, a
            second model audits it, and you keep a receipt anyone can verify.
          </p>
          <div className="cta">
            <a className="btn primary" href="#review">
              Check a document ↓
            </a>
            <Link className="btn" href="/compare">
              Catch a swapped page →
            </Link>
          </div>
        </div>
        <Till />
      </section>

      <div className="stats">
        <div>
          <strong>3</strong>
          <span>trust layers on every answer</span>
        </div>
        <div>
          <strong>5</strong>
          <span>kinds of document, one file each</span>
        </div>
        <div>
          <strong>0</strong>
          <span>AI calls on the verify page</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>open-weight models</span>
        </div>
      </div>

      <div className="section-title">
        <h2>Four days a contract costs you money</h2>
        <span className="muted small">Most tools only show up for the first one.</span>
      </div>
      <ol className="moments">
        {MOMENTS.map((m) => (
          <li key={m.n}>
            <Link href={m.href}>
              <span className="moment-tag">{m.tag}</span>
              <span className="moment-n">{m.n}</span>
              <strong>{m.when}</strong>
              <span>{m.what}</span>
            </Link>
          </li>
        ))}
      </ol>
      <Checker enclaveAvailable={Boolean(teeConfig())} />
    </main>
  );
}
