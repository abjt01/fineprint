import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Header from "@/components/Header";
import { teeConfig } from "@/lib/llm";
import { MODELS } from "@/lib/reader";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });
const sans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-mono" });

// runs before paint, so a saved light or dark choice never flashes the other theme first
const THEME = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Receipts",
  description:
    "AI with receipts. Reads your rent agreement, offer letter, loan or insurance policy with every answer quoted from the PDF and checked in code, compares the draft with the printed copy, sets alarms for the dates that cost money, and checks deductions against what you signed.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceae4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e11" },
  ],
};

const pretty = (m) => m.replace(/^.*\//, "").replace("gpt-oss-", "GPT-OSS ").replace("qwen3.8-27b", "Qwen 3.8 27B").replace(/(\d+)b$/, "$1B");

export default function RootLayout({ children }) {
  const tee = teeConfig();
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>
        <Header />
        {children}
        <footer className="foot no-print">
          <div className="foot-in">
            <p>
              {tee
                ? tee.kind === "tinfoil"
                  ? `Documents are read by ${pretty(tee.model)} inside a Tinfoil enclave whose code is checked against its public release before anything is sent (or on Groq, if you switch that off).`
                  : `Documents are read by ${pretty(tee.model)} running inside a TEE, so the reply is signed by the enclave.`
                : `Documents are read by open-weight models (${pretty(MODELS.big)} and ${pretty(MODELS.small)}) on Groq. TEE mode is off on this server.`}{" "}
              {pretty(MODELS.audit)} audits every answer. Flags, dates, sums and comparisons are plain code.
            </p>
            <p>This is not legal advice. Every answer shows the line it came from, so read that line yourself.</p>
            <p>
              Open source, MIT. Built at Hacktoberfest Hack Day Bengaluru 2026. The receipt format is in RECEIPT_SPEC.md.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
