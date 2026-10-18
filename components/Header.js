"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  ["/", "Review"],
  ["/compare", "Compare"],
  ["/settle", "Money day"],
  ["/verify", "Verify"],
];

const ICONS = {
  light: <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />,
  system: <path d="M4 5h16v11H4zM9 20h6M12 16v4" />,
  dark: <path d="M21 13.5A8.5 8.5 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5Z" />,
};

// Light, dark, or whatever the device says. The choice is kept in localStorage; a tiny script in the
// layout applies it before the first paint so the page never flashes the wrong theme.
function ThemeSwitch() {
  const [mode, setMode] = useState("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setMode(saved);
    } catch {
      // storage blocked: stay on system
    }
  }, []);
  function pick(next) {
    setMode(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // not saved, still applied for this visit
    }
  }
  return (
    <div className="theme" role="group" aria-label="Colour theme">
      {["light", "system", "dark"].map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} title={`${m[0].toUpperCase()}${m.slice(1)} theme`} onClick={() => pick(m)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[m]}
          </svg>
          <span className="sr-only">{m}</span>
        </button>
      ))}
    </div>
  );
}

export default function Header() {
  const path = usePathname();
  return (
    <header className="top no-print">
      <div className="top-in">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            ₹
          </span>
          fineprint
        </Link>
        <nav>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  );
}
