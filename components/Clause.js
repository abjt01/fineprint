"use client";

import { useId, useState } from "react";
import { findQuote } from "./format";

// One clause: the plain answer, a stamp saying whether its quote was found, the auditor's view,
// and the page itself with the quoted line marked.
export default function Clause({ clause: c, pages }) {
  const [open, setOpen] = useState(false);
  const [showPage, setShowPage] = useState(false);
  const id = useId();
  const status = c.check.status;
  const stamp =
    status === "verified" ? (c.tries > 1 ? { cls: "fixed", text: `↻ p.${c.check.page}`, tip: "Found on the second try, after the model was shown the page." } : { cls: "verified", text: `✓ p.${c.check.page}`, tip: "Found on this page by plain string search." })
      : status === "missing" ? { cls: "missing", text: "not in it", tip: "The agreement doesn't seem to say." }
      : { cls: "check", text: "? check", tip: c.check.why };

  const pageText = c.check.page && pages?.[c.check.page - 1];
  const at = pageText ? findQuote(pageText, c.quote) : null;

  return (
    <li className="clause" id={`clause-${c.key}`}>
      <div className="clause-row">
        <div className="clause-main">
          <div className="clause-label">{c.label}</div>
          <div className="clause-answer">{c.found ? c.answer : <span className="muted">Not in this agreement.</span>}</div>
          {c.audit && !c.audit.agrees && <div className="audit-warn">Second model disagrees: {c.audit.note || "read the line yourself."}</div>}
        </div>
        {c.found ? (
          <button type="button" className={`stamp ${stamp.cls}`} title={stamp.tip} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            {stamp.text}
          </button>
        ) : (
          <span className={`stamp ${stamp.cls}`}>{stamp.text}</span>
        )}
      </div>
      {open && (
        <div id={id} className="clause-proof">
          <blockquote className={`quote ${status === "verified" ? "" : "bad"}`}>
            “{c.quote}”
            <cite>
              {status === "verified" ? `Page ${c.check.page}${c.check.match === "close" ? ", matched allowing for line breaks" : ""}.` : `Couldn't find this line: ${c.check.why}`}
              {c.audit?.agrees && " A second model agrees it says this."}
            </cite>
          </blockquote>
          {pageText && (
            <>
              <button type="button" className="linkish" onClick={() => setShowPage((s) => !s)}>
                {showPage ? "Hide page" : `Show it on page ${c.check.page}`}
              </button>
              {showPage && (
                <pre className="page">
                  {at ? (
                    <>
                      {pageText.slice(0, at.start)}
                      <mark>{pageText.slice(at.start, at.end)}</mark>
                      {pageText.slice(at.end)}
                    </>
                  ) : (
                    pageText
                  )}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
