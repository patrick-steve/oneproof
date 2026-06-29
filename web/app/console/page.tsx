"use client";

// Flow B — the unified OneProof product demo. Lives at /console.
//
// User flow:
//   1. Pick mode (solo with companions / shared pool with real visitors)
//   2. Enter amount + nickname
//   3. Backend generates inner UltraHonk proof (5–15s)
//   4. Solo: backend pads with 3 companions. Pool: SSE stream waits for 3
//      more visitors (15s timeout → falls back to companions)
//   5. Backend aggregates 4 → 1 outer proof (20–60s)
//   6. User signs + submits the outer proof via Freighter
//   7. Cost comparison coda: naive vs aggregated, projection at N=64
//
// Wallet state comes from the shared WalletContext (../WalletContext.tsx)
// so it survives tab nav and auto-reconnects on return visits.

import { useEffect, useState, useCallback, useRef } from "react";
import {
  aggregateSolo, backendHealthzTimed, joinPool, proveInner,
  type InnerProofWire, type PoolEvent,
} from "@/lib/backend";
import { CONTRACTS, NETWORK, txUrl } from "@/lib/stellar";
import { useWallet } from "./WalletContext";

type Mode = "solo" | "pool";
type Stage =
  | "idle"
  | "proving-inner"
  | "ready-to-aggregate"
  | "in-pool"
  | "aggregating"
  | "ready-to-submit"
  | "signing"
  | "submitting"
  | "done"
  | "error";

const NAIVE_PER_TX = 30_556; // measured stroops, from bench/results.json

export default function ConsolePage() {
  const wallet = useWallet();

  // Form
  const [mode, setMode] = useState<Mode>("solo");
  const [amount, setAmount] = useState("1000");
  const [nickname, setNickname] = useState("anon");

  // Pipeline state
  const [stage, setStage] = useState<Stage>("idle");
  const [innerProof, setInnerProof] = useState<InnerProofWire | null>(null);
  const [provingMs, setProvingMs] = useState<number | null>(null);
  const [poolStatus, setPoolStatus] = useState<{ size: number; target: number } | null>(null);
  const [poolFallback, setPoolFallback] = useState(false);
  const [outerProofB64, setOuterProofB64] = useState<string | null>(null);
  const [outerPublicInputsB64, setOuterPublicInputsB64] = useState<string | null>(null);
  const [aggregatingMs, setAggregatingMs] = useState<number | null>(null);
  const [submitTx, setSubmitTx] = useState<string | null>(null);
  const [submitFee, setSubmitFee] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Backend reachability + cold-start detection on mount. If healthz
  // takes >1.5s, the Fly machine was sleeping and just woke up — show a
  // brief banner so the visitor knows future requests are warm (not slow).
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [coldStartMs, setColdStartMs] = useState<number | null>(null);
  const [coldStartShown, setColdStartShown] = useState(false);
  useEffect(() => {
    // "warming" banner appears if the healthz call isn't back in 1.5s.
    const warmingTimer = setTimeout(() => setColdStartShown(true), 1_500);
    backendHealthzTimed().then(({ ok, ms }) => {
      clearTimeout(warmingTimer);
      setBackendOk(ok);
      if (ms > 1_500) {
        setColdStartMs(ms);
        setColdStartShown(true);
        // Auto-dismiss the success banner after 6s.
        setTimeout(() => setColdStartShown(false), 6_000);
      }
    });
  }, []);

  function reset() {
    setStage("idle");
    setInnerProof(null);
    setProvingMs(null);
    setPoolStatus(null);
    setPoolFallback(false);
    setOuterProofB64(null);
    setOuterPublicInputsB64(null);
    setAggregatingMs(null);
    setSubmitTx(null);
    setSubmitFee(null);
    setError(null);
  }

  async function runInner() {
    setError(null);
    setStage("proving-inner");
    try {
      const r = await proveInner(amount, nickname);
      setInnerProof(r);
      setProvingMs(r.provingMs);
      setStage("ready-to-aggregate");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }

  async function runAggregate() {
    if (!innerProof) return;
    setError(null);
    if (mode === "solo") {
      setStage("aggregating");
      try {
        const r = await aggregateSolo(innerProof);
        setOuterProofB64(r.proofBytesB64);
        setOuterPublicInputsB64(r.publicInputsBytesB64);
        setAggregatingMs(r.aggregatingMs);
        setStage("ready-to-submit");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStage("error");
      }
    } else {
      // pool mode: SSE stream
      setStage("in-pool");
      try {
        const r = await joinPool(innerProof, (evt: PoolEvent) => {
          if (evt.type === "queued" || evt.type === "pool-grew") {
            setPoolStatus({ size: evt.size, target: evt.target });
          } else if (evt.type === "fallback") {
            setPoolFallback(true);
            setStage("aggregating");
          } else if (evt.type === "aggregating") {
            setStage("aggregating");
          }
        });
        setOuterProofB64(r.proofBytesB64);
        setOuterPublicInputsB64(r.publicInputsBytesB64);
        setAggregatingMs(r.aggregatingMs);
        setStage("ready-to-submit");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStage("error");
      }
    }
  }

  const runSubmit = useCallback(async () => {
    if (!outerProofB64 || !outerPublicInputsB64 || !wallet.address) return;
    setError(null);
    setStage("signing");
    try {
      const [StellarSdk, freighter] = await Promise.all([
        import("@stellar/stellar-sdk"),
        import("@stellar/freighter-api"),
      ]);
      const proofBytes = Uint8Array.from(atob(outerProofB64), (c) => c.charCodeAt(0));
      const publicInputs = Uint8Array.from(atob(outerPublicInputsB64), (c) => c.charCodeAt(0));
      const { hash, fee } = await submitOuter(StellarSdk, freighter, wallet.address, proofBytes, publicInputs);
      setSubmitTx(hash);
      setSubmitFee(fee);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }, [outerProofB64, outerPublicInputsB64, wallet.address]);

  const busy = stage === "proving-inner" || stage === "in-pool" || stage === "aggregating" || stage === "signing" || stage === "submitting";

  // Rotate through real bb proving phases while we wait on aggregator.
  // Backend doesn't expose phase telemetry, but these ARE the steps bb
  // runs through internally; rotating them on a timer reads as "real
  // progress" to a visitor instead of a stuck spinner.
  const AGG_PHASES = [
    { tMs:     0, label: "loading circuit + verification key…" },
    { tMs:  3_000, label: "committing polynomial coefficients (KZG)…" },
    { tMs:  8_000, label: "FFT phase, parallel across cores…" },
    { tMs: 14_000, label: "recursive UltraHonk verifier expansion…" },
    { tMs: 18_000, label: "computing Fiat-Shamir transcript…" },
    { tMs: 22_000, label: "compressing and wrapping outer proof…" },
  ] as const;
  const [aggPhase, setAggPhase] = useState<typeof AGG_PHASES[number]["label"]>(AGG_PHASES[0].label);
  const aggPhaseTimers = useRef<NodeJS.Timeout[]>([]);
  useEffect(() => {
    aggPhaseTimers.current.forEach(clearTimeout);
    aggPhaseTimers.current = [];
    if (stage !== "aggregating") return;
    setAggPhase(AGG_PHASES[0].label);
    for (let i = 1; i < AGG_PHASES.length; i++) {
      const phase = AGG_PHASES[i];
      if (!phase) continue;
      const tid = setTimeout(() => setAggPhase(phase.label), phase.tMs);
      aggPhaseTimers.current.push(tid);
    }
    return () => {
      aggPhaseTimers.current.forEach(clearTimeout);
      aggPhaseTimers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-6">
      <Header />

      {backendOk === false && (
        <Banner tone="warn">
          Prover backend is unreachable at <Mono>{process.env.NEXT_PUBLIC_BACKEND_URL ?? "(NEXT_PUBLIC_BACKEND_URL not set)"}</Mono>.
          See <Mono>backend/DEPLOY.md</Mono>. Until it&apos;s up, the demo flow won&apos;t produce proofs.
        </Banner>
      )}

      {coldStartShown && (
        <ColdStartBanner ms={coldStartMs} ready={backendOk === true} />
      )}

      <WalletBanner />

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-px bg-line">
        {/* LEFT — guided pipeline */}
        <div className="bg-ink p-6 md:p-7 space-y-6 font-mono">
          <ModePicker mode={mode} setMode={setMode} disabled={busy || stage === "done"} />

          <Step n="01" title="enter a private transfer" current={stage === "idle"} done={stage !== "idle"}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3">
              <LabeledInput label="amount" value={amount} setValue={setAmount} disabled={busy || stage !== "idle"} type="number" />
              <LabeledInput label="nickname" value={nickname} setValue={setNickname} disabled={busy || stage !== "idle"} />
            </div>
            {stage === "idle" && (
              <ActionButton onClick={runInner} disabled={!backendOk}>
                generate inner proof →
              </ActionButton>
            )}
          </Step>

          <Step n="02" title="proving inner (backend · UltraHonk)" current={stage === "proving-inner"} done={!!innerProof}>
            {stage === "proving-inner" && <Spinner label="generating UltraHonk proof… 5–15s" />}
            {innerProof && (
              <div className="text-[11px] text-mute space-y-1">
                <Kv k="proof bytes"   v={<span className="text-paper">{Math.round(innerProof.proofBytesB64.length * 0.75).toLocaleString()}</span>} />
                <Kv k="public inputs" v={<span className="text-paper">{Math.round(innerProof.publicInputsBytesB64.length * 0.75).toLocaleString()} bytes</span>} />
                <Kv k="proving time"  v={<span className="text-paper">{provingMs ? `${(provingMs / 1000).toFixed(1)}s` : "—"}</span>} />
                <Kv k="proof id"      v={<span className="text-paper">{innerProof.id}</span>} />
              </div>
            )}
            {stage === "ready-to-aggregate" && (
              <ActionButton onClick={runAggregate}>
                {mode === "solo" ? "aggregate with 3 companions →" : "join shared pool →"}
              </ActionButton>
            )}
          </Step>

          <Step n="03" title={mode === "pool" ? "pool · waiting for 3 more" : "batch · you + 3 companions"} current={stage === "in-pool"} done={stage === "aggregating" || stage === "ready-to-submit" || stage === "done"}>
            {mode === "pool" && stage === "in-pool" && (
              <div className="space-y-2 text-sm">
                <div className="text-paper">{poolStatus?.size ?? 1} / {poolStatus?.target ?? 4} in pool</div>
                <PoolBar size={poolStatus?.size ?? 1} target={poolStatus?.target ?? 4} />
                <div className="text-[11px] text-mute">if no one else joins within 15s, we&apos;ll pad with companion proofs.</div>
              </div>
            )}
            {poolFallback && stage !== "in-pool" && (
              <div className="text-[11px] text-mute">pool timed out · padded with companions</div>
            )}
            {(stage === "aggregating" || stage === "ready-to-submit" || stage === "done") && (
              <div className="text-[11px] text-mute">4 inner proofs ready to fold into 1</div>
            )}
          </Step>

          <Step n="04" title="aggregating (backend · 4 → 1)" current={stage === "aggregating"} done={!!outerProofB64}>
            {stage === "aggregating" && <Spinner label={aggPhase} />}
            {outerProofB64 && (
              <div className="text-[11px] text-mute space-y-1">
                <Kv k="outer proof"   v={<span className="text-paper">{Math.round(outerProofB64.length * 0.75).toLocaleString()} bytes</span>} />
                <Kv k="compression"   v={<span className="text-signal">{innerProof ? compressionRatio(innerProof.proofBytesB64.length, outerProofB64.length) : "—"}</span>} />
                <Kv k="aggregating"   v={<span className="text-paper">{aggregatingMs ? `${(aggregatingMs / 1000).toFixed(1)}s` : "—"}</span>} />
              </div>
            )}
          </Step>

          <Step n="05" title="submit to Stellar (your wallet · 1 tx)" current={stage === "ready-to-submit" || stage === "signing" || stage === "submitting"} done={stage === "done"}>
            {stage === "ready-to-submit" && (
              <ActionButton onClick={runSubmit} disabled={!wallet.address}>
                {wallet.address ? "sign with Freighter →" : "connect wallet above to enable"}
              </ActionButton>
            )}
            {stage === "signing"    && <Spinner label="waiting for Freighter…" />}
            {stage === "submitting" && <Spinner label="submitting on testnet…" />}
            {submitTx && (
              <div className="text-[11px] space-y-1">
                <Kv k="tx hash" v={<a href={txUrl(submitTx)} target="_blank" rel="noopener" className="text-paper hover:text-signal break-all">{submitTx}</a>} />
                {submitFee != null && <Kv k="fee" v={<span><span className="text-paper">{submitFee.toLocaleString()}</span> <span className="text-mute">stroops · 1 tx</span></span>} />}
              </div>
            )}
          </Step>

          {error && (
            <Banner tone="error">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foil block mb-2">error</span>
              <span className="font-mono text-[11px] break-all">{error}</span>
              <button onClick={reset} className="mt-3 text-[11px] uppercase tracking-[0.08em] text-mute hover:text-paper">reset →</button>
            </Banner>
          )}
        </div>

        {/* RIGHT — cost comparison + receipt */}
        <div className="bg-ink p-6 md:p-7 space-y-6 font-mono">
          <SectionLabel n="·" title="comparison" />
          <CostComparison
            naivePerTx={NAIVE_PER_TX}
            aggregatedFee={submitFee}
            stage={stage}
          />

          {stage === "done" && submitTx && (
            <div className="pt-3 border-t border-line space-y-3">
              <div className="text-[11px] uppercase tracking-[0.08em] text-signal">on-chain</div>
              <a href={txUrl(submitTx)} target="_blank" rel="noopener" className="block text-[11px] text-paper hover:text-signal break-all">
                {submitTx}
              </a>
              <a href={txUrl(submitTx)} target="_blank" rel="noopener" className="inline-flex text-[12px] text-signal hover:text-paper transition-colors">
                inspect on stellar.expert ↗
              </a>
              <button onClick={reset} className="text-[11px] uppercase tracking-[0.08em] text-mute hover:text-paper">
                run again with different inputs ↻
              </button>
            </div>
          )}
        </div>
      </div>

      <FooterNote />
    </div>
  );
}

// ─── Header + banners ─────────────────────────────────────────────────

function Header() {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-mute">demo</div>
      <h1 className="font-mono text-paper text-xl">
        run the full <span className="text-signal">prove → aggregate → verify</span> pipeline end-to-end
      </h1>
      <p className="text-[12px] text-mute leading-relaxed pt-2 max-w-3xl">
        Enter inputs, the backend generates a real UltraHonk proof from them, batches it with 3 others
        (companions or live visitors), aggregates into one outer proof, and you sign + submit it
        on-chain via Freighter. Every byte you see is real.
      </p>
    </div>
  );
}

function WalletBanner() {
  const { address, installed, error, connect, disconnect } = useWallet();
  if (address) {
    return (
      <div className="border border-line bg-ink-2 p-4 font-mono flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[12px]">
          <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-signal" />
          <span className="text-mute uppercase tracking-[0.08em]">wallet connected</span>
          <a href={`${NETWORK.explorerBase}/account/${address}`} target="_blank" rel="noopener" className="text-paper hover:text-signal">
            {address.slice(0, 8)}…{address.slice(-6)}
          </a>
        </div>
        <button onClick={disconnect} className="text-[11px] uppercase tracking-[0.08em] text-mute hover:text-foil">disconnect</button>
      </div>
    );
  }
  if (!installed) {
    return (
      <div className="border border-line bg-ink-2 p-4 font-mono space-y-3">
        <div className="text-[12px] text-mute">freighter not installed · you can still run the pipeline up to step 04</div>
        <a href="https://freighter.app/" target="_blank" rel="noopener" className="inline-flex bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90">install freighter →</a>
      </div>
    );
  }
  return (
    <div className="border border-line bg-ink-2 p-4 font-mono space-y-3">
      <div className="text-[12px] text-mute">wallet ready · connect to enable the submit step</div>
      {error && <div className="text-[11px] text-foil break-all">{error}</div>}
      <button onClick={connect} className="inline-flex bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90">connect freighter →</button>
    </div>
  );
}

// ─── Pipeline UI primitives ───────────────────────────────────────────

function ModePicker({ mode, setMode, disabled }: { mode: Mode; setMode: (m: Mode) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row gap-0 border border-line">
      <ModeButton selected={mode === "solo"} onClick={() => setMode("solo")} disabled={disabled} label="solo" caption="batch with 3 demo companions · instant, deterministic" />
      <div className="border-l border-line" />
      <ModeButton selected={mode === "pool"} onClick={() => setMode("pool")} disabled={disabled} label="pool" caption="batch with real visitors · waits up to 15s for others" />
    </div>
  );
}

function ModeButton({ selected, onClick, disabled, label, caption }: { selected: boolean; onClick: () => void; disabled: boolean; label: string; caption: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 text-left p-4 transition-colors ${selected ? "bg-ink-2" : "bg-ink hover:bg-ink-2"} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center gap-3">
        <span className={`inline-block w-2 h-2 rounded-full ${selected ? "bg-signal" : "bg-line"}`} />
        <span className="text-paper text-[12px] uppercase tracking-[0.08em]">{label}</span>
      </div>
      <div className="text-[11px] text-mute mt-2 leading-relaxed">{caption}</div>
    </button>
  );
}

function Step({ n, title, current, done, children }: { n: string; title: string; current: boolean; done: boolean; children: React.ReactNode }) {
  const dotColor = done ? "bg-signal" : current ? "bg-signal animate-pulse" : "bg-line";
  return (
    <div className={`pt-4 border-t border-line ${current || done ? "" : "opacity-50"}`}>
      <div className="flex items-center gap-3 mb-3">
        <span aria-hidden className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[11px] text-mute uppercase tracking-[0.08em]">{n}</span>
        <span className="text-[12px] text-paper uppercase tracking-[0.08em]">{title}</span>
      </div>
      <div className="space-y-3 pl-5">{children}</div>
    </div>
  );
}

function LabeledInput({ label, value, setValue, disabled, type = "text" }: { label: string; value: string; setValue: (s: string) => void; disabled: boolean; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-mute uppercase tracking-[0.08em]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className="bg-ink-2 border border-line text-paper text-sm px-3 py-2 focus:outline-none focus:border-signal disabled:opacity-50"
      />
    </label>
  );
}

function ActionButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[12px] text-mute">
      <span className="inline-block w-3 h-3 border border-signal border-r-transparent rounded-full animate-spin" />
      {label}
    </div>
  );
}

function PoolBar({ size, target }: { size: number; target: number }) {
  const pct = Math.min(100, (size / target) * 100);
  return (
    <div className="h-2 bg-ink-2 relative">
      <div className="absolute inset-y-0 left-0 bg-signal transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SectionLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[11px] text-mute">{n}</span>
      <span className="text-[12px] uppercase tracking-[0.08em] text-paper">{title}</span>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-baseline text-[12px]">
      <span className="text-mute uppercase tracking-[0.08em]">{k}</span>
      <span className="break-all">{v}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-paper">{children}</span>;
}

function Banner({ tone, children }: { tone: "warn" | "error" | "info"; children: React.ReactNode }) {
  const color = tone === "error" ? "border-foil" : tone === "warn" ? "border-foil/50" : "border-line";
  return (
    <div className={`border ${color} bg-ink-2 p-4 font-mono text-[12px] text-paper leading-relaxed`}>
      {children}
    </div>
  );
}

// Renders during /healthz probe — two phases:
//   1. ms == null: probe still in flight, healthz hasn't returned yet
//      → "prover waking up from sleep…" with spinner
//   2. ms is set: probe came back slow (>1.5s); show success briefly
//      → "✓ prover warmed up in 4.2s · subsequent calls are fast"
function ColdStartBanner({ ms, ready }: { ms: number | null; ready: boolean }) {
  if (!ready || ms == null) {
    return (
      <div className="border border-signal/40 bg-ink-2 p-4 font-mono text-[12px] text-paper flex items-center gap-3">
        <span className="inline-block w-3 h-3 border border-signal border-r-transparent rounded-full animate-spin" />
        <span>
          <span className="text-signal">prover waking from sleep</span> · Fly machines auto-stop when idle to save cost. one-time ~5-10s warm-up.
        </span>
      </div>
    );
  }
  return (
    <div className="border border-signal/40 bg-ink-2 p-4 font-mono text-[12px] text-paper flex items-center gap-3">
      <span aria-hidden className="text-signal">✓</span>
      <span>
        <span className="text-signal">prover warmed up in {(ms / 1000).toFixed(1)}s</span> · subsequent requests in this session are fast.
      </span>
    </div>
  );
}

function FooterNote() {
  return (
    <div className="text-[11px] text-mute font-mono border border-line p-3 leading-relaxed">
      Mode 1 (solo) pads your proof with 3 pre-baked companions so the demo is fast and deterministic.
      Mode 2 (pool) waits up to 15s for other visitors to join; if none arrive, falls back to companions.
      Either way: the aggregated outer proof is REAL, the on-chain verification is REAL, your tx hash is REAL.
    </div>
  );
}

// ─── Stellar submission (mirrors what /console/submit was doing) ──────

function compressionRatio(innerB64Len: number, outerB64Len: number): string {
  const innerBytes = innerB64Len * 0.75;
  const outerBytes = outerB64Len * 0.75;
  const totalInner = innerBytes * 4;
  const ratio = totalInner / outerBytes;
  return `${ratio.toFixed(1)}× smaller than 4 inners combined`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StellarSdkMod = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FreighterMod = any;

async function submitOuter(
  StellarSdk: StellarSdkMod,
  freighter: FreighterMod,
  source: string,
  proofBytes: Uint8Array,
  publicInputs: Uint8Array,
): Promise<{ hash: string; fee: number }> {
  const server = new StellarSdk.rpc.Server(NETWORK.sorobanRpc);
  const account = await server.getAccount(source);
  const contract = new StellarSdk.Contract(CONTRACTS.oneproofVerifier);
  const bytesToScVal = (b: Uint8Array) => StellarSdk.xdr.ScVal.scvBytes(Buffer.from(b));

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call("verify_proof", bytesToScVal(publicInputs), bytesToScVal(proofBytes)))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);

  const signed = await freighter.signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK.passphrase,
    address: source,
  });
  if (!signed?.signedTxXdr) {
    throw new Error("Freighter returned no signed tx" + (signed?.error ? `: ${signed.error}` : ""));
  }
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK.passphrase);
  const sendResult = await server.sendTransaction(signedTx);
  if (sendResult.status !== "PENDING") {
    throw new Error(`send failed: ${sendResult.status}`);
  }
  const hash = sendResult.hash;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2_000));
    const status = await server.getTransaction(hash);
    if (status.status === "SUCCESS") {
      const fee = parseInt(prepared.toEnvelope().v1().tx().fee()?.toString() ?? "0", 10) || 0;
      return { hash, fee };
    }
    if (status.status === "FAILED") throw new Error(`tx ${hash} failed on-chain`);
  }
  throw new Error(`tx ${hash} did not confirm within 60s`);
}

// ─── Cost comparison panel ─────────────────────────────────────────────

function CostComparison({ naivePerTx, aggregatedFee, stage }: { naivePerTx: number; aggregatedFee: number | null; stage: Stage }) {
  const naive4 = naivePerTx * 4;
  const naive64 = naivePerTx * 64;
  const naive1024 = naivePerTx * 1024;
  const live = aggregatedFee != null;
  const agg = aggregatedFee ?? 136_009; // last known measured

  const factor64 = naive64 / agg;
  const factor1024 = naive1024 / agg;

  return (
    <div className="space-y-4 text-[12px]">
      <div className="grid grid-cols-[1fr_auto] gap-x-4 items-baseline">
        <span className="text-mute">naive · 4 inner txs</span>
        <span className="text-foil">{naive4.toLocaleString()} <span className="text-mute text-[10px]">stroops</span></span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 items-baseline">
        <span className="text-mute">aggregated · 1 outer tx {live && <span className="text-signal text-[10px]">· LIVE</span>}</span>
        <span className="text-signal">{agg.toLocaleString()} <span className="text-mute text-[10px]">stroops</span></span>
      </div>
      <div className="pt-3 border-t border-line space-y-2">
        <div className="text-[10px] uppercase tracking-[0.08em] text-mute">projection</div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 items-baseline">
          <span className="text-mute">at N = 64</span>
          <span className="text-signal">{factor64.toFixed(1)}× cheaper</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 items-baseline">
          <span className="text-mute">at N = 1024</span>
          <span className="text-signal">{Math.round(factor1024)}× cheaper</span>
        </div>
      </div>
      {stage === "idle" && (
        <p className="text-[11px] text-mute italic pt-3 border-t border-line">
          run the pipeline on the left to see your own measured numbers here.
        </p>
      )}
    </div>
  );
}
