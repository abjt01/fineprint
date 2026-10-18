import Compare from "@/components/Compare";

export const metadata = { title: "Printed vs promised · Fineprint" };

export default function ComparePage() {
  return (
    <main className="wrap">
      <section className="hero">
        <p className="eyebrow">At the signing desk · no AI on this page</p>
        <h1>Is the printed copy what you agreed to?</h1>
        <p className="lede">
          The draft came on WhatsApp. The copy on stamp paper is five pages, and the broker is waiting. Drop both PDFs here and see every word
          that changed, with its page in each, before you sign.
        </p>
      </section>
      <Compare />
    </main>
  );
}
