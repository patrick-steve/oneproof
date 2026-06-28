"use client";

// Verify tab — live event feed against the OneProof + Groth16 batch
// verifier contracts on Stellar testnet. Two-pane layout:
//   left  = streaming list of recent verify ops (auto-polls every 20s)
//   right = detail pane for the selected event (proof + vk pointers,
//           link out to stellar.expert for full XDR)
//
// When the live API is unreachable we render the committed events from
// bench/results.json with an explicit "live feed offline" banner — the
// dashboard is never empty.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CONTRACTS,
  contractUrl,
  fetchRecentVerifies,
  shortHash,
  staticFallbackEvents,
  txUrl,
  ago,
  type VerifyEvent,
} from "@/lib/stellar";

const POLL_MS = 20_000;
const LIMIT = 30;

type FeedStatus = "init" | "live" | "fallback";

export default function VerifyClient() {
  const fallback = useMemo(() => staticFallbackEvents(), []);
  const [events, setEvents] = useState<VerifyEvent[]>(fallback);
  const [status, setStatus] = useState<FeedStatus>("init");
  const [selected, setSelected] = useState<VerifyEvent | null>(fallback[0] ?? null);
  const [tick, setTick] = useState(0); // forces "ago" recomputes

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const next = await fetchRecentVerifies(LIMIT);
        if (!alive) return;
        if (next.length > 0) {
          setEvents(next);
          setStatus("live");
          if (!selected || !next.some((e) => e.txHash === selected.txHash)) {
            setSelected(next[0]);
          }
        } else {
          setStatus("fallback");
        }
      } catch {
        if (alive) setStatus("fallback");
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(t);
    };
    // We intentionally do not depend on `selected` — selection is sticky;
    // re-poll just replaces the list and the detail pane refreshes from
    // the (possibly updated) record matching the same txHash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-6">
      <Header status={status} count={events.length} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-px bg-line">
        <FeedList events={events} selected={selected} onSelect={setSelected} />
        <DetailPane event={selected} />
      </div>

      <ContractRow />
    </div>
  );
}

function Header({ status, count }: { status: FeedStatus; count: number }) {
  const label =
    status === "live" ? "live · stellar testnet" :
    status === "fallback" ? "live feed offline · showing committed measurements" :
                            "connecting…";
  const pulseOn = status === "live";
  return (
    <div className="flex items-baseline justify-between gap-4 flex-wrap">
      <div className="space-y-1">
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-mute flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block w-1.5 h-1.5 rounded-full ${pulseOn ? "bg-signal animate-pulse" : "bg-mute"}`}
          />
          {label}
        </div>
        <h1 className="font-mono text-paper text-xl">
          {count.toLocaleString()} <span className="text-mute text-base">recent verifications</span>
        </h1>
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
        polling every 20s
      </div>
    </div>
  );
}

function FeedList({
  events,
  selected,
  onSelect,
}: {
  events: VerifyEvent[];
  selected: VerifyEvent | null;
  onSelect: (e: VerifyEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="bg-ink p-6 font-mono text-mute text-sm">
        no verifications yet
      </div>
    );
  }
  return (
    <ul className="bg-ink divide-y divide-line max-h-[70vh] overflow-y-auto">
      {events.map((e) => {
        const isSel = selected?.txHash === e.txHash;
        return (
          <li key={e.txHash}>
            <button
              onClick={() => onSelect(e)}
              className={`w-full text-left p-4 font-mono transition-colors ${
                isSel
                  ? "bg-ink-2 border-l-2 border-l-signal"
                  : "hover:bg-ink-2/60 border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <ModePill label={e.contractLabel} fn={e.function} />
                <span className="text-[11px] text-mute" suppressHydrationWarning>
                  {/* parent re-renders every 1s via the `tick` state, which
                      causes this to recompute. The ago() value depends only
                      on Date.now() and the timestamp, not on tick directly. */}
                  {ago(e.timestamp)}
                </span>
              </div>
              <div className="text-paper text-[13px] mt-2 break-all">
                {shortHash(e.txHash, 14, 10)}
              </div>
              <div className="flex items-baseline justify-between gap-3 mt-2 text-[11px] text-mute">
                <span>ledger {e.ledger ? e.ledger.toLocaleString() : "—"}</span>
                <span className="text-paper">
                  {e.feeCharged.toLocaleString()} <span className="text-mute">stroops</span>
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ModePill({
  label,
  fn,
}: {
  label: VerifyEvent["contractLabel"];
  fn: string;
}) {
  const color =
    label === "oneproof" ? "text-signal border-signal/40" : "text-paper border-line";
  return (
    <span className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] border px-1.5 py-0.5 ${color}`}>
      <span>{label}</span>
      <span className="text-mute">·</span>
      <span className="text-mute">{fn}</span>
    </span>
  );
}

function DetailPane({ event }: { event: VerifyEvent | null }) {
  if (!event) {
    return (
      <div className="bg-ink p-6 font-mono text-mute text-sm">
        select a verification to inspect
      </div>
    );
  }
  return (
    <div className="bg-ink p-6 font-mono space-y-6 max-h-[70vh] overflow-y-auto">
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.08em] text-mute">transaction</div>
        <div className="text-paper text-[13px] break-all leading-relaxed">{event.txHash}</div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-mute mt-2">
          <span>ledger {event.ledger.toLocaleString() || "—"}</span>
          <span>{ago(event.timestamp)}</span>
          <span>{event.successful ? "succeeded" : "failed"}</span>
        </div>
      </div>

      <Kv k="contract" v={
        <Link href={contractUrl(event.contractId)} target="_blank" rel="noopener" className="hover:text-paper underline decoration-line">
          {shortHash(event.contractId, 14, 10)}
        </Link>
      } />
      <Kv k="function" v={<span className="text-signal">{event.function}</span>} />
      <Kv k="fee_charged" v={<span><span className="text-paper">{event.feeCharged.toLocaleString()}</span> <span className="text-mute">stroops</span></span>} />
      <Kv k="mode" v={
        event.contractLabel === "oneproof"
          ? <span>recursive · 1 outer UltraHonk proof aggregating K inner proofs</span>
          : <span>batch · M Groth16 proofs combined via BN254 MSM</span>
      } />

      <div className="border border-line p-3 space-y-2 mt-6 text-[11px]">
        <div className="text-mute uppercase tracking-[0.08em]">decoded proof + vk</div>
        <p className="text-mute leading-relaxed">
          Full XDR (proof bytes, public inputs, fees breakdown) lives in the operation
          envelope. Click through to the explorer for the byte-level view; we keep
          the on-page footprint to a summary.
        </p>
        <Link
          href={txUrl(event.txHash)}
          target="_blank"
          rel="noopener"
          className="inline-flex text-signal hover:text-paper transition-colors mt-1"
        >
          inspect on stellar.expert ↗
        </Link>
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-baseline text-[12px]">
      <span className="text-mute uppercase tracking-[0.08em]">{k}</span>
      <span className="text-paper break-all">{v}</span>
    </div>
  );
}

function ContractRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line">
      <ContractCard
        label="oneproof_verifier"
        purpose="recursive · UltraHonk · K=4 base case"
        id={CONTRACTS.oneproofVerifier}
      />
      <ContractCard
        label="groth16_batch_verifier"
        purpose="batched · BN254 MSM · M Groth16 proofs/tx"
        id={CONTRACTS.groth16BatchVerifier}
      />
    </div>
  );
}

function ContractCard({ label, purpose, id }: { label: string; purpose: string; id: string }) {
  return (
    <div className="bg-ink p-4 font-mono space-y-1">
      <div className="text-[11px] uppercase tracking-[0.08em] text-mute">{label}</div>
      <div className="text-[11px] text-mute">{purpose}</div>
      <Link
        href={contractUrl(id)}
        target="_blank"
        rel="noopener"
        className="block text-paper text-[13px] hover:text-signal break-all transition-colors mt-1"
      >
        {id}
      </Link>
    </div>
  );
}
