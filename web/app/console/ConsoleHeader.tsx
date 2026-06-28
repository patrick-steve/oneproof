"use client";

// Sticky console header. Reads wallet state from WalletContext so the
// "wallet connected" pill survives tab navigation. Header has three
// regions: wordmark + tab nav (left), spacer, status pills (right).

import Link from "next/link";
import ConsoleNav from "./ConsoleNav";
import { useWallet } from "./WalletContext";

export default function ConsoleHeader() {
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
        <WalletPill />
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

function WalletPill() {
  const { address } = useWallet();
  if (!address) return null;
  return (
    <div
      className="hidden md:flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-mute border border-line px-2 py-1"
      title={`Connected: ${address}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal" aria-hidden />
      <span className="text-paper normal-case tracking-normal">
        {address.slice(0, 4)}…{address.slice(-4)}
      </span>
    </div>
  );
}
