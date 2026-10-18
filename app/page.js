import Checker from "@/components/Checker";

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <p className="eyebrow">For tenants in Bengaluru, and everywhere else</p>
        <h1>Don&apos;t sign it until you&apos;ve seen the receipt.</h1>
        <p className="lede">
          Upload your rental agreement. You get the clauses that cost you money, each quoted from the PDF with its page
          number. Every quote is checked in code, a second model audits the reading, and the whole result is sealed in a
          receipt anyone can verify later.
        </p>
      </section>
      <Checker />
    </main>
  );
}
