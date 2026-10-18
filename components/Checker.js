"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Clause from "./Clause";
import { rupees, saveReceipt } from "./format";

const STEPS = [
  "Pulling the text out of every page",
  "Reading the clauses that cost you money",
  "Finding every quote in the PDF, in code",
  "Re-asking where a quote didn't match",
  "Second model auditing each answer",
  "Working out the red flags",
  "Sealing the receipt",
];

export default function Checker() {
  const [state, setState] = useState({ status: "idle" });
  const [step, setStep] = useState(0);
  const input = useRef(null);
  const results = useRef(null);

  useEffect(() => {
    if (state.status !== "busy") return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    return () => clearInterval(t);
  }, [state.status]);

  async function run(form) {
    setState({ status: "busy" });
    try {
      const res = await fetch("/api/check", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      saveReceipt(data.receipt);
      setState({ status: "done", ...data });
      setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setState({ status: "error", error: err.message });
    }
  }

  function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    run(form);
    e.target.value = "";
  }

  function sample() {
    const form = new FormData();
    form.append("sample", "1");
    run(form);
  }

  const busy = state.status === "busy";

  return (
    <>
      <section className="drop no-print" aria-busy={busy}>
        <div className="drop-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
            Upload agreement PDF
          </button>
          <button type="button" className="btn" disabled={busy} onClick={sample}>
            Try a sample Bengaluru agreement
          </button>
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={upload} />
        </div>
        <p className="small muted">
          Text PDFs only, up to 20 MB. The sample is made up (<a href="/bengaluru-rent-agreement.pdf" target="_blank">open it</a>) and has the
          usual traps left in.
        </p>
        {busy && (
          <ol className="steps" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "done" : i === step ? "now" : ""}>
                {s}
              </li>
            ))}
          </ol>
        )}
        {state.status === "error" && <p className="error">{state.error}</p>}
      </section>

      {state.status === "done" && <Result receipt={state.receipt} pages={state.pages} auditRan={state.auditRan} anchor={results} />}
    </>
  );
}

function Result({ receipt, pages, auditRan, anchor }) {
  const { clauses, flags, stake, tee, document: doc } = receipt;
  const found = clauses.filter((c) => c.found);
  const verified = found.filter((c) => c.check.status === "verified");
  const fixed = verified.filter((c) => c.tries > 1);
  const audited = verified.filter((c) => c.audit);
  const disagree = audited.filter((c) => !c.audit.agrees);
  const signed = (tee || []).filter((p) => p.ok);

  function download() {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.name.replace(/\.pdf$/i, "")}.receipt.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="result" ref={anchor}>
      <div className="trust">
        <Layer ok={verified.length === found.length} title="1. Found in your PDF" detail={`${verified.length} of ${found.length} quotes found on their page by plain string search${fixed.length ? `, ${fixed.length} after the model was asked again` : ""}.`} />
        <Layer
          ok={auditRan && !disagree.length}
          warn={!auditRan || disagree.length > 0}
          title="2. Second opinion"
          detail={auditRan ? (disagree.length ? `A second model disagrees on ${disagree.length}. Look at those yourself.` : `A second model agrees with all ${audited.length} readings.`) : "The auditor didn't answer this time."}
        />
        <Layer
          ok={signed.length > 0 && signed.length === tee.length}
          warn={!tee}
          title="3. Signed in an enclave"
          detail={tee ? (signed.length === tee.length ? `${signed.length} model replies signed inside a TEE by ${tee[0].signingAddress?.slice(0, 10)}…` : `${tee.length - signed.length} of ${tee.length} proofs didn't check out.`) : "TEE mode is off on this server, so the model's reply isn't signed. Layers 1 and 2 still hold."}
        />
      </div>

      {stake && (
        <div className="stake">
          <div>
            <span className="stake-label">Deposit</span>
            <span className="stake-num">{rupees(stake.deposit)}</span>
            <span className="stake-sub">{Number(stake.depositMonths.toFixed(1))} months of rent</span>
          </div>
          <div>
            <span className="stake-label">Fair under the Model Tenancy Act</span>
            <span className="stake-num">{rupees(stake.fairDeposit)}</span>
            <span className="stake-sub">two months of rent</span>
          </div>
          <div>
            <span className="stake-label">Cut no matter what</span>
            <span className="stake-num">{rupees(stake.fixedDeductions)}</span>
            <span className="stake-sub">{stake.refundDays ? `back after ${stake.refundDays} days` : "no refund date given"}</span>
          </div>
        </div>
      )}

      {flags.length > 0 && (
        <div className="card">
          <h2>What to push back on</h2>
          <ul className="flags">
            {flags.map((f) => (
              <li key={f.title} className={`flag ${f.level}`}>
                <strong>{f.title}</strong>
                <p>{f.detail}</p>
                {f.law && (
                  <p className="law">
                    {f.law.act}, Section {f.law.section}. {f.law.note}
                  </p>
                )}
                <p className="flag-links">
                  From:{" "}
                  {f.keys.map((k) => {
                    const c = clauses.find((x) => x.key === k);
                    return c ? (
                      <a key={k} href={`#clause-${k}`}>
                        {c.label} (p.{c.check.page})
                      </a>
                    ) : null;
                  })}
                </p>
              </li>
            ))}
          </ul>
          <p className="small muted">Flags are worked out by plain code, and only from clauses whose quote was found in the PDF.</p>
        </div>
      )}

      <div className="card">
        <h2>Every clause, with its line</h2>
        <ul className="clauses">
          {clauses.map((c) => (
            <Clause key={c.key} clause={c} pages={pages} />
          ))}
        </ul>
      </div>

      <div className="receipt">
        <div className="receipt-head">
          <span>RENT RECEIPT</span>
          <span>v{receipt.version}</span>
        </div>
        <dl>
          <dt>Document</dt>
          <dd>{doc.name}, {doc.pages} pages</dd>
          <dt>PDF sha256</dt>
          <dd className="hash">{doc.sha256}</dd>
          <dt>Clauses</dt>
          <dd>{verified.length} verified, {found.length - verified.length} to check, {clauses.length - found.length} not in the agreement</dd>
          <dt>Enclave</dt>
          <dd>{tee ? `${signed.length}/${tee.length} replies signed` : "off"}</dd>
          <dt>Receipt digest</dt>
          <dd className="hash">{receipt.digest}</dd>
        </dl>
        <div className="receipt-actions no-print">
          <button type="button" className="btn primary" onClick={download}>
            Download receipt
          </button>
          <Link className="btn" href="/verify?last=1">
            Verify it now
          </Link>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>
    </section>
  );
}

function Layer({ ok, warn, title, detail }) {
  return (
    <div className={`layer ${ok ? "ok" : warn ? "warn" : "bad"}`}>
      <span className="layer-mark" aria-hidden="true">
        {ok ? "✓" : warn ? "–" : "✕"}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}
