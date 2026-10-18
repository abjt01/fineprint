import Verifier from "@/components/Verifier";

export const metadata = { title: "Verify a receipt · Rent Receipt" };

export default function VerifyPage() {
  return (
    <main className="wrap">
      <section className="hero">
        <p className="eyebrow">No AI on this page</p>
        <h1>Verify a receipt.</h1>
        <p className="lede">
          Got a receipt from a friend, a broker or your own past self? Drop it here. This page uses no model at all: it
          re-hashes the receipt, finds every quote in the PDF again and checks the enclave&apos;s signatures. Change one
          number in the file and it turns red.
        </p>
      </section>
      <Verifier />
    </main>
  );
}
