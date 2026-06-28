"use client";

// Live verify counter — polls stellar.expert's public API for the contract's
// recent activity. 30s cadence. When the API is unavailable (rate limits,
// CORS, downtime), the component shows the last successful measurement from
// bench/results.json with an explicit offline label, NOT a silent dash.

import { useEffect, useState } from "react";
import { RESULTS } from "@/lib/bench";

const ONEPROOF_VERIFIER = "CB2GZVKSS4VW5MCLPRCTE4XQKHYGXTUIPB3AGZQG62STUSTOLCYP526D";
const POLL_INTERVAL_MS = 30_000;

interface LiveState {
  totalInvocations: number | null;
  lastTxHash: string | null;
  lastSeenAt: number | null;
  ok: boolean;
  // null = haven't tried yet; true/false set after the first fetch
  initialFetchDone: boolean;
}

const INITIAL: LiveState = {
  totalInvocations: null,
  lastTxHash: null,
  lastSeenAt: null,
  ok: false,
  initialFetchDone: false,
};

// Static fallback values from results.json — what we show when the live
// feed is unavailable. The recursive verify tx is the headline measurement.
const STATIC_FALLBACK = {
  lastTx: RESULTS.runs.find((r) => r.mode === "recursive")?.txHashes?.[0] ?? "",
  lastFeeStroops: RESULTS.runs.find((r) => r.mode === "recursive")?.resourceFeeStroops ?? 0,
};

export default function StellarLive() {
  const [state, setState] = useState<LiveState>(INITIAL);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const resp = await fetch(
          `https://api.stellar.expert/explorer/testnet/contract/${ONEPROOF_VERIFIER}`,
          { cache: "no-store" },
        );
        if (!resp.ok) throw new Error(`stellar.expert ${resp.status}`);
        const data = await resp.json();
        if (!alive) return;
        setState({
          totalInvocations: data?.payments ?? data?.operations ?? null,
          lastTxHash: data?.last_tx ?? null,
          lastSeenAt: Date.now(),
          ok: true,
          initialFetchDone: true,
        });
      } catch {
        if (!alive) return;
        setState((s) => ({ ...s, ok: false, initialFetchDone: true }));
      }
    }

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Three render states:
  //   1. not yet fetched         → "connecting" stub
  //   2. fetched, live data ok    → live readout
  //   3. fetched, API unavailable → committed-fallback readout
  if (!state.initialFetchDone) {
    return <Frame label="contacting" pulseOn={false} body={<div className="text-mute text-sm">connecting to stellar.expert…</div>} />;
  }

  if (state.ok) {
    return (
      <Frame
        label="live · stellar testnet"
        pulseOn
        body={
          <>
            <div className="text-paper text-2xl">
              {state.totalInvocations != null ? state.totalInvocations.toLocaleString() : "—"}
              <span className="text-mute text-sm ml-2">verify ops on the contract</span>
            </div>
            <ContractLink lastSeenAt={state.lastSeenAt} />
          </>
        }
      />
    );
  }

  // Offline state: show what we DO know from results.json, not a dash.
  return (
    <Frame
      label="live feed offline · showing committed measurements"
      pulseOn={false}
      body={
        <>
          <div className="text-paper text-xl">
            {STATIC_FALLBACK.lastFeeStroops.toLocaleString()}
            <span className="text-mute text-sm ml-2">stroops · last recursive verify · 1 tx</span>
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${STATIC_FALLBACK.lastTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mute text-[11px] break-all hover:text-paper"
          >
            tx&nbsp;{STATIC_FALLBACK.lastTx.slice(0, 12)}…{STATIC_FALLBACK.lastTx.slice(-6)}&nbsp;↗
          </a>
        </>
      }
    />
  );
}

function Frame({
  label,
  pulseOn,
  body,
}: {
  label: string;
  pulseOn: boolean;
  body: React.ReactNode;
}) {
  return (
    <div className="border border-line p-5 font-mono space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.08em] text-mute">{label}</div>
        <Pulse on={pulseOn} />
      </div>
      {body}
    </div>
  );
}

function ContractLink({ lastSeenAt }: { lastSeenAt: number | null }) {
  return (
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
      {lastSeenAt && (
        <span className="ml-2 text-mute">
          · updated {Math.round((Date.now() - lastSeenAt) / 1000)}s ago
        </span>
      )}
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
