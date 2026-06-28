import Link from "next/link";
import type { ReactNode } from "react";
import { WalletProvider } from "./WalletContext";
import ConsoleHeader from "./ConsoleHeader";

// Shared shell for the /console product surface. Wraps the whole console
// in a single WalletProvider so wallet state persists across tab
// navigation. The header is a client component so it can read the wallet
// context for the connected-state pill.

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <div className="min-h-screen flex flex-col">
        <ConsoleHeader />
        <div className="flex-1">{children}</div>
        <ConsoleFooter />
      </div>
    </WalletProvider>
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
