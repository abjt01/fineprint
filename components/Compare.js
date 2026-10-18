"use client";

import { useRef, useState } from "react";

export default function Compare() {
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [state, setState] = useState({ status: "idle" });
  const a = useRef(null);
  const b = useRef(null);

  async function run(sample = false) {
    const form = new FormData();
    if (sample) form.append("sample", "1");
    else {
      form.append("before", before);
      form.append("after", after);
    }
    setState({ status: "busy" });
    try {
      const res = await fetch("/api/compare", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setState({ status: "done", sample, ...data });
    } catch (err) {
      setState({ status: "error", error: err.message });
    }
  }

  return (
    <section className="card">
      <div className="verify-inputs">
        <div>
          <button type="button" className="btn" onClick={() => a.current?.click()}>
            The draft you agreed to
          </button>
          <span className="picked">{before?.name || "the PDF from WhatsApp or email"}</span>
          <input ref={a} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => setBefore(e.target.files?.[0] || null)} />
        </div>
        <div>
          <button type="button" className="btn" onClick={() => b.current?.click()}>
            The copy you&apos;re asked to sign
          </button>
          <span className="picked">{after?.name || "a scan won't work, ask for the soft copy"}</span>
          <input ref={b} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => setAfter(e.target.files?.[0] || null)} />
        </div>
      </div>
      <div className="drop-actions">
        <button type="button" className="btn primary" disabled={!before || !after || state.status === "busy"} onClick={() => run(false)}>
          Compare
        </button>
        <button type="button" className="btn" disabled={state.status === "busy"} onClick={() => run(true)}>
          Try the sample: draft vs printed
        </button>
      </div>
      {state.status === "error" && <p className="error">{state.error}</p>}
      {state.status === "done" && (
        <div className="diff">
          <h2>{state.changes.length ? `${state.changes.length} change${state.changes.length === 1 ? "" : "s"} between the two` : "The two say exactly the same thing."}</h2>
          {state.sample && (
            <p className="small muted">
              Sample files: <a href="/bengaluru-rent-agreement-draft.pdf" target="_blank">draft</a> and <a href="/bengaluru-rent-agreement.pdf" target="_blank">printed copy</a>.
            </p>
          )}
          <ol className="changes">
            {state.changes.map((c) => (
              <li key={c.id}>
                <div className="change-head">
                  <strong>{c.clause ? c.clause.label : "Change"}</strong>
                  <span className="small muted">
                    draft p.{c.pageBefore} → signed copy p.{c.pageAfter}
                  </span>
                </div>
                {c.numbers && (c.numbers.was.length > 0 || c.numbers.now.length > 0) && (
                  <p className="num-change">
                    <span className="was">{c.numbers.was.map((n) => n.toLocaleString("en-IN")).join(", ") || "nothing"}</span> →{" "}
                    <span className="now">{c.numbers.now.map((n) => n.toLocaleString("en-IN")).join(", ") || "nothing"}</span>
                  </p>
                )}
                <p className="diff-text">
                  <span className="muted">…{c.lead} </span>
                  {c.before && <del>{c.before}</del>} {c.after && <ins>{c.after}</ins>}
                  <span className="muted"> {c.tail}…</span>
                </p>
              </li>
            ))}
          </ol>
          <p className="small muted">This is a word-by-word comparison in plain code. No model was asked anything, so nothing here can be made up.</p>
        </div>
      )}
    </section>
  );
}
