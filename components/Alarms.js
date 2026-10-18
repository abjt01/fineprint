"use client";

// Trap alarms, and a calendar file with a reminder the day before each one.
const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const ics = (iso) => iso.replace(/-/g, "");
const esc = (s) => String(s).replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

function calendar(alarms, name) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Receipts//Trap alarms//EN", "CALSCALE:GREGORIAN"];
  alarms.forEach((a, i) => {
    lines.push("BEGIN:VEVENT", `UID:${ics(a.date)}-${i}@receipts`, `DTSTAMP:${stamp}`);
    if (a.monthlyDay) {
      const first = `${a.date.slice(0, 8)}${String(a.monthlyDay).padStart(2, "0")}`;
      lines.push(`DTSTART;VALUE=DATE:${ics(first)}`, `RRULE:FREQ=MONTHLY;BYMONTHDAY=${a.monthlyDay};UNTIL=${ics(a.until)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ics(a.date)}`);
    }
    lines.push(`SUMMARY:${esc(`${a.title} (${name})`)}`, `DESCRIPTION:${esc(`${a.detail}\nFrom the agreement, page ${a.from.map((f) => f.page).join(", ")}. Worked out by Receipts.`)}`);
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", `DESCRIPTION:${esc(a.title)}`, "END:VALARM", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export default function Alarms({ alarms, name }) {
  if (!alarms?.length) return null;
  function download() {
    const blob = new Blob([calendar(alarms, name)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trap-alarms.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="card">
      <div className="card-head">
        <h2>Trap alarms</h2>
        <button type="button" className="btn small-btn" onClick={download}>
          Add to calendar (.ics)
        </button>
      </div>
      <p className="small muted">The days this agreement can cost you money, worked out from its own dates. Each one reminds you a day early.</p>
      <ol className="alarms">
        {alarms.map((a) => (
          <li key={a.title + a.date}>
            <span className="alarm-date">{a.monthlyDay ? `Every month, ${a.monthlyDay}th` : fmt(a.date)}</span>
            <div>
              <strong>{a.title}</strong>
              <p>{a.detail}</p>
              <p className="small muted">
                From {a.from.map((f) => (
                  <a key={f.key} href={`#clause-${f.key}`}>
                    p.{f.page}{" "}
                  </a>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
