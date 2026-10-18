"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Alarms from "./Alarms";
import AskBox from "./AskBox";
import Clause from "./Clause";
import { saveReceipt } from "./format";

const STEPS = [
  "Pulling the text out of every page",
  "Working out what kind of document this is",
  "Reading the clauses that cost you money",
  "Finding every quote in the PDF, in code",
  "Re-asking where a quote didn't match",
  "Second model auditing each answer",
  "Working out flags and dates",
  "Sealing the receipt",
];

const SAMPLES = [
  { id: "rent", name: "Bengaluru rent agreement", short: "rent agreement", file: "/bengaluru-rent-agreement.pdf" },
  { id: "job", name: "Fresher's offer letter", short: "offer letter", file: "/sample-offer-letter.pdf" },
  { id: "loan", name: "Personal loan", short: "loan agreement", file: "/sample-loan-agreement.pdf" },
];

export const PACK_CHOICES = [
  { id: "auto", name: "Work it out" },
  { id: "rent", name: "Rent agreement" },
  { id: "job", name: "Job offer" },
  { id: "loan", name: "Loan / EMI" },
  { id: "insurance", name: "Health insurance" },
  { id: "general", name: "Any contract / T&C" },
];

export default function Checker() {
  const [state, setState] = useState({ status: "idle" });
  const [pack, setPack] = useState("auto");
  const [step, setStep] = useState(0);
  const input = useRef(null);
  const results = useRef(null);

  useEffect(() => {
    if (state.status !== "busy") return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 650);
    return () => clearInterval(t);
  }, [state.status]);

  async function run(form) {
    if (pack !== "auto") form.append("pack", pack);
    setState({ status: "busy" });
    try {
      const res = await fetch("/api/check", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      saveReceipt(data.receipt);
      setState({ status: "done", sample: form.get("sample") === "rent", ...data });
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

  function sample(kind) {
    const form = new FormData();
    form.append("sample", kind);
    run(form);
  }

  const busy = state.status === "busy";

  return (
    <>
      <section className="drop no-print" aria-busy={busy} id="review">
        <h2>Before you sign</h2>
        <div className="chips" role="radiogroup" aria-label="Kind of document">
          {PACK_CHOICES.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={pack === p.id} className={`chip${pack === p.id ? " on" : ""}`} onClick={() => setPack(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="drop-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
            Upload a PDF
          </button>
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={upload} />
        </div>
        <div className="samples">
          <span className="small muted">Or try a sample:</span>
          {SAMPLES.map((s) => (
            <button key={s.id} type="button" className="chip" disabled={busy} onClick={() => sample(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <p className="small muted">
          Text PDFs up to 20 MB. The samples are made up, with the usual traps left in:{" "}
          {SAMPLES.map((s, i) => (
            <span key={s.id}>
              <a href={s.file} target="_blank">
                {s.short}
              </a>
              {i < SAMPLES.length - 1 ? ", " : "."}
            </span>
          ))}{" "}
          Got a draft and a printed copy? <Link href="/compare">Compare them</Link>.
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

      {state.status === "done" && <Result {...state} anchor={results} />}
    </>
  );
}

function Result({ receipt, pages, doc, pack, alarms, auditRan, sample, anchor }) {
  const { clauses, flags, summary, tee, document: file } = receipt;
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
    a.download = `${file.name.replace(/\.pdf$/i, "")}.receipt.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="result" ref={anchor}>
      <p className="pack-line">
        Read as a <strong>{pack.name.toLowerCase()}</strong>. Not right? Pick the kind above and upload again.
      </p>
      <div className="trust">
        <Layer ok={verified.length === found.length} title="1. Found in your PDF" detail={`${verified.length} of ${found.length} quotes found on their page by plain string search${fixed.length ? `, ${fixed.length} after the model was asked again` : ""}.`} />
        <Layer
          ok={auditRan && !disagree.length}
          warn={!auditRan || disagree.length > 0}
          title="2. Second opinion"
          detail={auditRan ? (disagree.length ? `A second model disagrees on ${disagree.length}. Look at ${disagree.length === 1 ? "that one" : "those"} yourself.` : `A second model agrees with all ${audited.length} readings.`) : "The auditor didn't answer this time."}
        />
        <Layer
          ok={signed.length > 0 && signed.length === tee.length}
          warn={!tee}
          title="3. Signed in an enclave"
          detail={tee ? (signed.length === tee.length ? `${signed.length} model replies signed inside a TEE by ${tee[0].signingAddress?.slice(0, 10)}…` : `${tee.length - signed.length} of ${tee.length} proofs didn't check out.`) : "TEE mode is off on this server, so the model's reply isn't signed. Layers 1 and 2 still hold."}
        />
      </div>

      {summary?.length > 0 && (
        <div className="stake">
          {summary.map((t) => (
            <div key={t.label}>
              <span className="stake-label">{t.label}</span>
              <span className="stake-num">{t.value}</span>
              <span className="stake-sub">{t.sub}</span>
            </div>
          ))}
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
                {f.keys.length > 0 && (
                  <p className="flag-links">
                    From:{" "}
                    {f.keys.map((k) => {
                      const c = clauses.find((x) => x.key === k && x.check.status === "verified");
                      return c ? (
                        <a key={k} href={`#clause-${k}`}>
                          {c.label} (p.{c.check.page})
                        </a>
                      ) : null;
                    })}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="small muted">Flags are worked out by plain code, and only from clauses whose quote was found in the PDF.</p>
        </div>
      )}

      <Alarms alarms={alarms} name={file.name} />

      <div className="card">
        <h2>Every clause, with its line</h2>
        <ul className="clauses">
          {clauses.map((c) => (
            <Clause key={c.key} clause={c} pages={pages} />
          ))}
        </ul>
      </div>

      <AskBox doc={doc} questions={pack.questions} pages={pages} sample={sample} />

      <div className="receipt">
        <div className="receipt-head">
          <span>RECEIPT</span>
          <span>v{receipt.version}</span>
        </div>
        <dl>
          <dt>Document</dt>
          <dd>
            {file.name}, {file.pages} pages
          </dd>
          <dt>Read as</dt>
          <dd>{pack.name}</dd>
          <dt>PDF sha256</dt>
          <dd className="hash">{file.sha256}</dd>
          <dt>Clauses</dt>
          <dd>
            {verified.length} verified, {found.length - verified.length} to check, {clauses.length - found.length} not in it
          </dd>
          <dt>Enclave</dt>
          <dd>{tee ? `${signed.length}/${tee.length} replies signed` : "off"}</dd>
          <dt>Receipt digest</dt>
          <dd className="hash">{receipt.digest}</dd>
        </dl>
        <p className="small receipt-keep">Keep this file. On the day money is deducted, it&apos;s what you check them against.</p>
        <div className="receipt-actions no-print">
          <button type="button" className="btn primary" onClick={download}>
            Download receipt
          </button>
          <Link className="btn" href="/settle?last=1">
            Money day
          </Link>
          <Link className="btn" href="/verify?last=1">
            Verify it
          </Link>
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
