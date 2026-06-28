import Link from "next/link";
import type { ReactNode } from "react";
import ConsoleNav from "./ConsoleNav";

// Shared shell for the /console product surface. Persistent header with
// the OneProof wordmark, three tabs (active one signal-colored — see
// ConsoleNav for the usePathname highlight), a live-network pill, and
// a thin hairline divider.

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
        <ConsoleNav />
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
