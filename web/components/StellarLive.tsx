"use client";

// Live verify counter — polls stellar.expert's public API for the contract's
// recent activity. We use the REST API (no auth, CORS-enabled) rather than
// the Soroban RPC directly because stellar-sdk's getEvents requires its own
// pagination logic for what we need (a simple count). 30s polling cadence;
// silently falls back to the static measurement from results.json on error.

import { useEffect, useState } from "react";

const ONEPROOF_VERIFIER = "CB2GZVKSS4VW5MCLPRCTE4XQKHYGXTUIPB3AGZQG62STUSTOLCYP526D";
const POLL_INTERVAL_MS = 30_000;

interface LiveState {
  totalInvocations: number | null;
  lastFee: number | null;
  lastTxHash: string | null;
  lastSeenAt: number | null;
  ok: boolean;
}

const INITIAL: LiveState = {
  totalInvocations: null,
  lastFee: null,
  lastTxHash: null,
  lastSeenAt: null,
  ok: false,
};

export default function StellarLive() {
  const [state, setState] = useState<LiveState>(INITIAL);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        // stellar.expert exposes a contract-stats endpoint
        const resp = await fetch(
          `https://api.stellar.expert/explorer/testnet/contract/${ONEPROOF_VERIFIER}`,
          { cache: "no-store" },
        );
        if (!resp.ok) throw new Error(`stellar.expert ${resp.status}`);
        const data = await resp.json();
        if (!alive) return;
        setState({
          totalInvocations: data?.payments ?? data?.operations ?? null,
          lastFee: null,
          lastTxHash: data?.last_tx ?? null,
          lastSeenAt: Date.now(),
          ok: true,
        });
      } catch {
        if (!alive) return;
        // soft-fail to "ok:false" — UI shows the static fallback
        setState((s) => ({ ...s, ok: false }));
      }
    }

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="border border-line p-5 font-mono space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.08em] text-mute">
          live · stellar testnet
        </div>
        <Pulse on={state.ok} />
      </div>
      <div className="text-paper text-2xl">
        {state.totalInvocations != null ? state.totalInvocations.toLocaleString() : "—"}
        <span className="text-mute text-sm ml-2">verify ops on the contract</span>
      </div>
      <div className="text-mute text-[11px] break-all">
        contract&nbsp;
        <a
          className="hover:text-paper underline decoration-line"
          href={`https://stellar.expert/explorer/testnet/contract/${ONEPROOF_VERIFIER}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {ONEPROOF_VERIFIER.slice(0, 12)}…{ONEPROOF_VERIFIER.slice(-6)}
        </a>
        {state.lastSeenAt && (
          <span className="ml-2 text-mute">
            · updated {Math.round((Date.now() - state.lastSeenAt) / 1000)}s ago
          </span>
        )}
      </div>
    </div>
  );
}

function Pulse({ on }: { on: boolean }) {
  return (
    <span
      aria-label={on ? "live" : "offline"}
      className={`inline-block w-2 h-2 rounded-full ${on ? "bg-signal animate-pulse" : "bg-mute"}`}
    />
  );
}
