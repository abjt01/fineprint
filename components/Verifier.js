"use client";

import { useEffect, useRef, useState } from "react";
import { loadReceipt } from "./format";

export default function Verifier() {
  const [receiptText, setReceiptText] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [pdf, setPdf] = useState(null);
  const [state, setState] = useState({ status: "idle" });
  const receiptInput = useRef(null);
  const pdfInput = useRef(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("last") !== "1") return;
    const last = loadReceipt();
    if (last) {
      setReceiptText(last);
      setReceiptName("the receipt you just made");
    }
  }, []);

  async function check(text = receiptText, label) {
    setState({ status: "busy" });
    const form = new FormData();
    form.append("receipt", text);
    if (pdf) form.append("file", pdf);
    try {
      const res = await fetch("/api/verify", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setState({ status: "done", label, ...data });
    } catch (err) {
      setState({ status: "error", error: err.message });
    }
  }

  // The demo for doubters: quietly change one number, the way someone might edit a receipt to win an argument.
  function tamper() {
    try {
      const r = JSON.parse(receiptText);
      const c = r.clauses.find((x) => x.key === "deposit" && Number.isFinite(x.value)) || r.clauses.find((x) => Number.isFinite(x.value));
      if (!c) return;
      c.value = Math.round(c.value / 5);
      c.answer = `${c.label}: Rs. ${c.value.toLocaleString("en-IN")} (edited)`;
      const edited = JSON.stringify(r, null, 2);
      setReceiptText(edited);
      setReceiptName(`${receiptName || "receipt"}, with ${c.label.toLowerCase()} edited`);
      check(edited, `Changed ${c.label.toLowerCase()} to Rs. ${c.value.toLocaleString("en-IN")}`);
    } catch {
      setState({ status: "error", error: "That receipt isn't valid JSON." });
    }
  }

  async function pickReceipt(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceiptText(await f.text());
    setReceiptName(f.name);
    setState({ status: "idle" });
    e.target.value = "";
  }

  return (
    <section className="card verify">
      <div className="verify-inputs">
        <div>
          <button type="button" className="btn" onClick={() => receiptInput.current?.click()}>
            Choose receipt (.json)
          </button>
          <span className="picked">{receiptName || "none yet"}</span>
          <input ref={receiptInput} type="file" accept="application/json,.json" hidden onChange={pickReceipt} />
        </div>
        <div>
          <button type="button" className="btn" onClick={() => pdfInput.current?.click()}>
            Add the agreement PDF (optional)
          </button>
          <span className="picked">{pdf ? pdf.name : "without it, the quotes can't be re-found"}</span>
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => setPdf(e.target.files?.[0] || null)} />
        </div>
      </div>
      <div className="drop-actions">
        <button type="button" className="btn primary" disabled={!receiptText || state.status === "busy"} onClick={() => check()}>
          Verify
        </button>
        <button type="button" className="btn danger" disabled={!receiptText || state.status === "busy"} onClick={tamper} title="Edits one number in the receipt, then verifies it">
          Tamper with it
        </button>
      </div>

      {state.status === "error" && <p className="error">{state.error}</p>}
      {state.status === "done" && (
        <div className={`verdict ${state.ok ? "ok" : "bad"}`}>
          <h2>{state.ok ? "Receipt holds up." : "Receipt does not hold up."}</h2>
          {state.label && <p className="small">{state.label}.</p>}
          <ul className="checks">
            {state.checks.map((c, i) => (
              <li key={i} className={c.ok ? "ok" : "bad"}>
                <span aria-hidden="true">{c.ok ? "✓" : "✕"}</span>
                <div>
                  <strong>{c.title}</strong>
                  <p>{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
