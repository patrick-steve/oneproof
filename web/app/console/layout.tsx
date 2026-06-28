import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell for the /console product surface. Persistent header with
// the OneProof wordmark, three tabs, a live-network pill, and a thin
// hairline divider. Product register: density over flourish, mono everywhere,
// no display-typeface marketing copy here.

const TABS = [
  { href: "/console/verify",    label: "verify",    desc: "watch verifications" },
  { href: "/console/submit",    label: "submit",    desc: "send a proof" },
  { href: "/console/aggregate", label: "aggregate", desc: "the K-to-1 path" },
] as const;

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <ConsoleHeader />
      <div className="flex-1">{children}</div>
      <ConsoleFooter />
    </div>
  );
}

function ConsoleHeader() {
  return (
    <header className="border-b border-line bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/70 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-3 flex items-center gap-6">
        <Link
          href="/"
          className="font-mono text-sm text-paper hover:text-signal transition-colors shrink-0"
        >
          oneproof <span className="text-mute">·</span> console
        </Link>
        <nav className="flex items-center gap-px overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.08em] text-mute hover:text-paper transition-colors whitespace-nowrap"
            >
              <span className="opacity-50 group-hover:opacity-100 transition-opacity">/</span>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <NetworkPill />
      </div>
    </header>
  );
}

function NetworkPill() {
  return (
    <div className="hidden md:flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal animate-pulse" aria-hidden />
      <span>testnet</span>
      <span className="text-line">·</span>
      <span>protocol 26</span>
    </div>
  );
}

function ConsoleFooter() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-4 font-mono text-[11px] uppercase tracking-[0.08em] text-mute flex justify-between items-center">
        <Link href="/" className="hover:text-paper">← back to the landing</Link>
        <span>v0.1 · console</span>
      </div>
    </footer>
  );
}
