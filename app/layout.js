import { IBM_Plex_Mono, IBM_Plex_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import { teeConfig } from "@/lib/llm";
import { MODELS } from "@/lib/reader";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-serif" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rent Receipt",
  description:
    "Reads your rental agreement before you sign it. Every answer is quoted from the PDF and checked in code, a second model audits it, and in TEE mode the model's reply is signed inside an enclave. You get a receipt anyone can verify.",
};

export const viewport = { themeColor: "#1c1b19" };

const pretty = (m) => m.replace(/^.*\//, "").replace("gpt-oss-", "GPT-OSS ").replace("qwen3.8-27b", "Qwen 3.8 27B").replace(/(\d+)b$/, "$1B");

export default function RootLayout({ children }) {
  const tee = teeConfig();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="top no-print">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              ₹
            </span>
            Rent Receipt
          </Link>
          <nav>
            <Link href="/">Check an agreement</Link>
            <Link href="/verify">Verify a receipt</Link>
          </nav>
        </header>
        {children}
        <footer className="foot no-print">
          <p>
            {tee
              ? `Agreements are read by ${pretty(tee.model)} running inside a TEE, so the reply is signed by the enclave.`
              : `Agreements are read by open-weight models (${pretty(MODELS.big)} and ${pretty(MODELS.small)}) on Groq. TEE mode is off on this server.`}{" "}
            {pretty(MODELS.audit)} audits every answer. Flags and sums are plain code.
          </p>
          <p>This is not legal advice. Every answer shows the line it came from, so read that line yourself.</p>
        </footer>
      </body>
    </html>
  );
}
