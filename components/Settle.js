"use client";

import { useEffect, useRef, useState } from "react";
import { loadReceipt, rupees } from "./format";

const SAMPLE =
  "Hi Ananya, flat inspection done. Deducting 45k from deposit: painting 32k, deep cleaning 8,000, fan repair 2,500, key replacement 2500. Will transfer balance next month.";

const LABEL = {
  allowed: "Agreed",
  over: "Over the limit",
  not_in_agreement: "Not in the agreement",
  ask_bills: "Ask for the bill",
  unclear: "Unclear",
};

// "receipt for bengaluru-rent-agreement.pdf (rent)", so it's clear which agreement the deductions are checked against
function describe(text, fallback) {
  try {
    const r = JSON.parse(text);
    return r?.document?.name ? `receipt for ${r.document.name}${r.pack ? ` (${r.pack})` : ""}` : fallback;
  } catch {
    return fallback;
  }
}

export default function Settle() {
  const [receipt, setReceipt] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const picker = useRef(null);

  useEffect(() => {
    const last = loadReceipt();
    if (last) {
      setReceipt(last);
      setName(describe(last, "the receipt you just made"));
    }
  }, []);

  async function check() {
    setState({ status: "busy" });
    setCopied(false);
    try {
      const res = await fetch("/api/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt, message }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setState({ status: "done", ...data });
    } catch (err) {
      setState({ status: "error", error: err.message });
    }
  }

  async function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setReceipt(text);
    setName(describe(text, f.name));
    e.target.value = "";
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.draft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card">
      <div className="verify-inputs">
        <div>
          <button type="button" className="btn" onClick={() => picker.current?.click()}>
            Choose your receipt (.json)
          </button>
          <span className="picked">{name || "the one you saved when you signed"}</span>
          <input ref={picker} type="file" accept="application/json,.json" hidden onChange={pick} />
        </div>
      </div>
      <label className="field-label" htmlFor="msg">
        What they&apos;re deducting (paste the WhatsApp message, email or settlement note)
      </label>
      <textarea id="msg" className="paste" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} placeholder="Deducting 45k: painting 32k, cleaning 8k, fan repair 5k" />
      <div className="drop-actions">
        <button type="button" className="btn primary" disabled={!receipt || message.trim().length < 10 || state.status === "busy"} onClick={check}>
          Check the deductions
        </button>
        <button type="button" className="btn" onClick={() => setMessage(SAMPLE)}>
          Paste an example message
        </button>
      </div>
      {!receipt && <p className="small muted">No receipt yet? Review the agreement first, then come back with its receipt.</p>}
      {state.status === "busy" && <p className="small muted">Checking each line against the receipt…</p>}
      {state.status === "error" && <p className="error">{state.error}</p>}

      {state.status === "done" && (
        <div className="settle">
          <div className="stake">
            <div>
              <span className="stake-label">They're deducting</span>
              <span className="stake-num">{rupees(state.claimed)}</span>
            </div>
            <div>
              <span className="stake-label">The agreement allows</span>
              <span className="stake-num">{rupees(state.allowed)}</span>
            </div>
            <div>
              <span className="stake-label">{state.owed !== null ? "You should get back" : "Disputed"}</span>
              <span className="stake-num">{rupees(state.owed !== null ? state.owed : state.disputed)}</span>
              {state.owed !== null && <span className="stake-sub">of {rupees(state.deposit)}</span>}
            </div>
          </div>
          <ul className="lines">
            {state.lines.map((l, i) => (
              <li key={i} className={`line ${l.status}`}>
                <div className="line-row">
                  <strong>{l.what}</strong>
                  <span className="num">{rupees(l.amount)}</span>
                </div>
                <span className={`tag ${l.status}`}>{LABEL[l.status]}</span> <span className="small">{l.why}</span>
                {l.clause && <blockquote className="quote small-quote">“{l.clause.quote}” <cite>Page {l.clause.page}</cite></blockquote>}
              </li>
            ))}
          </ul>
          <div className="draft">
            <div className="card-head">
              <h2>Your reply</h2>
              <button type="button" className="btn small-btn" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre>{state.draft}</pre>
            <p className="small muted">Written by code from the checked lines, not by a model, so every number and page in it is real.</p>
          </div>
        </div>
      )}
    </section>
  );
}
