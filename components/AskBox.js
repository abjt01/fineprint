"use client";

import { useState } from "react";
import Clause from "./Clause";

const SAMPLE_CLAIM =
  "Your deposit is Rs. 3,20,000 and it is refunded within 30 days of vacating. Rent is Rs. 32,000 per month. The owner pays for all structural repairs. You can sublet one room.";

// Ask the document anything, or paste what ChatGPT told you about it and see which parts hold.
export default function AskBox({ doc, questions = [], pages, sample }) {
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [state, setState] = useState({ status: "idle" });

  async function go(value = input) {
    const v = value.trim();
    if (!v) return;
    setInput(v);
    setState({ status: "busy" });
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "ask" ? { doc, question: v } : { doc, check: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setState({ status: "done", mode, ...data });
    } catch (err) {
      setState({ status: "error", error: err.message });
    }
  }

  const items = state.receipt?.clauses || [];
  const counts = items.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] || 0) + 1), a), {});

  return (
    <div className="card">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "ask"} className={mode === "ask" ? "on" : ""} onClick={() => { setMode("ask"); setState({ status: "idle" }); setInput(""); }}>
          Ask it anything
        </button>
        <button type="button" role="tab" aria-selected={mode === "check"} className={mode === "check" ? "on" : ""} onClick={() => { setMode("check"); setState({ status: "idle" }); setInput(""); }}>
          Check what ChatGPT told you
        </button>
      </div>

      {mode === "ask" ? (
        <>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); go(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask this document a question" maxLength={300} aria-label="Question" />
            <button type="submit" className="btn primary" disabled={state.status === "busy"}>
              Ask
            </button>
          </form>
          <div className="chips">
            {questions.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => go(q)} disabled={state.status === "busy"}>
                {q}
              </button>
            ))}
          </div>
          <p className="small muted">Every sentence of the answer has to come with its line. A sentence that can&apos;t be found in the PDF is marked, not hidden.</p>
        </>
      ) : (
        <>
          <textarea className="paste" rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste an answer from ChatGPT, Gemini, a broker or a friend about this document" maxLength={6000} aria-label="Text to check" />
          <div className="drop-actions">
            <button type="button" className="btn primary" disabled={state.status === "busy" || input.trim().length < 20} onClick={() => go()}>
              Check every claim
            </button>
            {sample && (
              <button type="button" className="btn" onClick={() => setInput(SAMPLE_CLAIM)}>
                Paste an example
              </button>
            )}
          </div>
        </>
      )}

      {state.status === "busy" && <p className="small muted">Reading…</p>}
      {state.status === "error" && <p className="error">{state.error}</p>}
      {state.status === "done" && (
        <div className="answer">
          {state.mode === "check" && (
            <p className="verdicts">
              <span className="v supported">{counts.supported || 0} supported</span>
              <span className="v contradicted">{counts.contradicted || 0} wrong</span>
              <span className="v not_found">{counts.not_found || 0} not in the document</span>
            </p>
          )}
          {!items.length && <p>{state.missing || "The document doesn't answer that."}</p>}
          <ul className="clauses">
            {items.map((c) => (
              <Clause key={c.key} clause={c} pages={pages} plain={state.mode === "ask"} />
            ))}
          </ul>
          {state.missing && items.length > 0 && <p className="small muted">Not covered: {state.missing}</p>}
        </div>
      )}
    </div>
  );
}
