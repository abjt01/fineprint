import Settle from "@/components/Settle";

export const metadata = { title: "Money day · Fineprint" };

export default function SettlePage() {
  return (
    <main className="wrap">
      <section className="hero">
        <p className="eyebrow">Money day</p>
        <h1>They&apos;re deducting money. Check it against what you signed.</h1>
        <p className="lede">
          Moving out and the owner is keeping part of the deposit? An insurer cutting &quot;non-payable items&quot;? A full-and-final with a
          notice recovery? Paste their message. Each line is checked against the receipt you saved when you signed, and you get a reply with
          page numbers in it.
        </p>
      </section>
      <Settle />
    </main>
  );
}
