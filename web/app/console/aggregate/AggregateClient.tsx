"use client";

// Aggregate tab — the thesis showcase. Three sections, top to bottom:
//
//   1. THE REAL RESULT.   The K=4 aggregator run that actually happened
//      on testnet (4 inner private-transfer proofs → 1 outer proof →
//      single verify tx). Numbers, hashes, ledger, fee. Auditable.
//
//   2. INTERACTIVE SIMULATOR.  Drag N. See tree composition (depth, leaf
//      count, aggregator-proof count), off-chain proving wall-time
//      projection, on-chain verify cost (flat). Communicates the
//      'constant in N' claim by letting the visitor operate it.
//
//   3. OPERATOR CONSOLE PREVIEW.  What a continuously running aggregator
//      service would expose (pending-K-fill, throughput, tree depth).
//      Honest label: ad-hoc invocation today; protocol for a service.

import { useMemo, useState } from "react";
import { RESULTS } from "@/lib/bench";
import { CONTRACTS, txUrl, contractUrl } from "@/lib/stellar";

const K = 4;
const RECURSIVE_TX =
  RESULTS.runs.find((r) => r.mode === "recursive")?.txHashes?.[0] ?? "";
const RECURSIVE_FEE =
  RESULTS.runs.find((r) => r.mode === "recursive")?.resourceFeeStroops ?? 0;
const RECURSIVE_LEDGER =
  (RESULTS.runs.find((r) => r.mode === "recursive") as { ledger?: number } | undefined)?.ledger ?? 0;
const NAIVE_PER_TX = 30_556; // measured single Groth16 verify on testnet (Tier 1)

export default function AggregateClient() {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-12">
      <Header />
      <RealResult />
      <Simulator />
      <OperatorConsolePreview />
    </div>
  );
}

function Header() {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-mute">aggregate</div>
      <h1 className="font-mono text-paper text-xl">
        the <span className="text-signal">K-to-1</span> path that keeps on-chain cost flat in N
      </h1>
    </div>
  );
}

// ─── Section 1: the real measured aggregation ───────────────────────────
function RealResult() {
  return (
    <section className="space-y-4">
      <SectionHeading n="01" title="the real result" caption="what happened on testnet on 2026-06-27" />
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-px bg-line">
        {/* tx receipt */}
        <div className="bg-ink p-5 font-mono space-y-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-signal">verified on-chain</div>
          <div className="space-y-2 text-[12px]">
            <Kv k="inner proofs" v={<span><span className="text-paper">{K}</span> <span className="text-mute">UltraHonk private-transfer proofs</span></span>} />
            <Kv k="aggregator"   v={<span><span className="text-paper">1</span> <span className="text-mute">outer UltraHonk proof (K-to-1)</span></span>} />
            <Kv k="on-chain"     v={<span><span className="text-paper">1</span> <span className="text-mute">verify_proof tx</span></span>} />
          </div>
          <div className="border-t border-line pt-3 space-y-2 text-[12px]">
            <Kv k="ledger" v={<span className="text-paper">{RECURSIVE_LEDGER.toLocaleString()}</span>} />
            <Kv k="fee"    v={<span><span className="text-paper">{RECURSIVE_FEE.toLocaleString()}</span> <span className="text-mute">stroops</span></span>} />
            <Kv k="tx"     v={<a href={txUrl(RECURSIVE_TX)} target="_blank" rel="noopener" className="text-signal hover:text-paper break-all">{RECURSIVE_TX}</a>} />
            <Kv k="contract" v={<a href={contractUrl(CONTRACTS.oneproofVerifier)} target="_blank" rel="noopener" className="text-paper hover:text-signal break-all">{CONTRACTS.oneproofVerifier}</a>} />
          </div>
        </div>
        {/* what aggregation buys you here */}
        <div className="bg-ink p-5 space-y-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">savings versus naive</div>
          <div className="space-y-3">
            <Row label="naive · 4 verifies"      value={(NAIVE_PER_TX * K).toLocaleString()} unit="stroops" tone="foil" />
            <Row label={`recursive · 1 verify`}  value={RECURSIVE_FEE.toLocaleString()}      unit="stroops" tone="signal" />
            <Row label="absolute savings"        value={(NAIVE_PER_TX * K - RECURSIVE_FEE).toLocaleString()} unit="stroops" />
            <div className="pt-1">
              <SavingsBar naive={NAIVE_PER_TX * K} recursive={RECURSIVE_FEE} />
            </div>
          </div>
          <p className="text-mute text-[12px] leading-relaxed pt-2">
            At K=4 the recursive line costs <span className="text-foil">more</span> in absolute
            terms (UltraHonk verification is structurally heavier than Groth16). The crossover
            with naive happens around N=5; past that the flat line wins, and at N=64 the
            recursive path is roughly 14× cheaper. The simulator below makes that visible.
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: "signal" | "foil" }) {
  const color = tone === "signal" ? "text-signal" : tone === "foil" ? "text-foil" : "text-paper";
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-3 font-mono text-[12px]">
      <span className="text-mute uppercase tracking-[0.08em]">{label}</span>
      <span><span className={color}>{value}</span> <span className="text-mute text-[11px]">{unit}</span></span>
    </div>
  );
}

function SavingsBar({ naive, recursive }: { naive: number; recursive: number }) {
  const pctRecursive = (recursive / naive) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.08em] text-mute">
        <span>recursive</span>
        <span>naive · 100%</span>
      </div>
      <div className="relative h-3 bg-line overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${pctRecursive}%` }} />
        <div className="absolute inset-y-0 left-0 right-0 bg-foil/15" style={{ left: `${pctRecursive}%` }} />
      </div>
      <div className="text-[10px] font-mono text-mute">
        recursive is {pctRecursive.toFixed(1)}% of naive · {(100 - pctRecursive).toFixed(1)}% saved
      </div>
    </div>
  );
}

// ─── Section 2: interactive simulator ───────────────────────────────────
function Simulator() {
  const [logN, setLogN] = useState(6); // 2^6 = 64

  const N = 1 << logN;
  const stats = useMemo(() => computeAggregation(N, K), [N]);

  return (
    <section className="space-y-4">
      <SectionHeading n="02" title="the simulator" caption={`drag N · 1 ≤ N ≤ ${(1 << 10).toLocaleString()}`} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-px bg-line">
        {/* controls */}
        <div className="bg-ink p-5 font-mono space-y-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-[0.08em] text-mute">N · inner proofs</span>
              <span className="text-paper text-2xl">{N.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={logN}
              onChange={(e) => setLogN(parseInt(e.target.value, 10))}
              aria-label={`N = ${N}`}
              aria-valuemin={1}
              aria-valuemax={1024}
              aria-valuenow={N}
              className="w-full accent-signal"
            />
            <div className="flex justify-between text-[10px] font-mono text-mute uppercase tracking-[0.08em]">
              {[0, 2, 4, 6, 8, 10].map((p) => (
                <span key={p}>{(1 << p).toLocaleString()}</span>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-4 space-y-2 text-[12px]">
            <Kv k="tree K"               v={<span className="text-paper">4</span>} />
            <Kv k="depth"                v={<span className="text-paper">{stats.depth}</span>} />
            <Kv k="aggregator proofs"    v={<span className="text-paper">{stats.aggregatorProofs.toLocaleString()}</span>} />
            <Kv k="off-chain prove time" v={<span><span className="text-paper">{formatTime(stats.proveMs)}</span> <span className="text-mute">est.</span></span>} />
          </div>
        </div>

        {/* readouts */}
        <div className="bg-ink p-5 font-mono space-y-5">
          <div className="space-y-3">
            <Row label="naive · on-chain"    value={(NAIVE_PER_TX * N).toLocaleString()} unit="stroops" tone="foil" />
            <Row label="recursive · on-chain" value={RECURSIVE_FEE.toLocaleString()} unit="stroops · flat" tone="signal" />
            <Row label="recursive savings"   value={pctSaved(NAIVE_PER_TX * N, RECURSIVE_FEE)} unit="vs naive" />
            <Row label="tx count · naive"    value={N.toLocaleString()} unit="" tone="foil" />
            <Row label="tx count · recursive" value="1" unit="" tone="signal" />
          </div>
          <TreeViz depth={stats.depth} k={K} />
        </div>
      </div>
    </section>
  );
}

function TreeViz({ depth, k }: { depth: number; k: number }) {
  // Render a tiny ASCII-ish tree showing the K-ary structure up to depth 3.
  // For larger depths the visual gets unreadable; we just label it.
  const renderableDepth = Math.min(depth, 3);
  const widthAt = (d: number) => Math.pow(k, d);
  const rows: number[] = [];
  for (let d = 0; d <= renderableDepth; d++) rows.push(widthAt(d));

  return (
    <div className="border border-line p-4 space-y-2">
      <div className="text-[11px] uppercase tracking-[0.08em] text-mute">tree composition</div>
      <div className="space-y-1">
        {rows.map((count, idx) => {
          const isRoot = idx === 0;
          const isLeaf = idx === rows.length - 1 && depth === renderableDepth;
          return (
            <div key={idx} className="flex items-center gap-2 text-[11px]">
              <span className="text-mute w-12 text-right">L{idx}</span>
              <span className="text-paper">
                {isRoot ? "●" : isLeaf ? Array(Math.min(count, 16)).fill("◦").join(" ") : Array(Math.min(count, 16)).fill("○").join(" ")}
                {count > 16 && <span className="text-mute">  +{(count - 16).toLocaleString()} more</span>}
              </span>
            </div>
          );
        })}
        {depth > renderableDepth && (
          <div className="text-[11px] text-mute pl-14">… {depth - renderableDepth} more level(s)</div>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-mute pt-1">
        ● root outer proof · ○ aggregator child · ◦ leaf inner proof
      </div>
    </div>
  );
}

// ─── Section 3: operator console preview ────────────────────────────────
function OperatorConsolePreview() {
  return (
    <section className="space-y-4">
      <SectionHeading n="03" title="operator console" caption="what a live aggregator service would expose" />
      <div className="border border-line p-5 font-mono space-y-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.08em] text-foil">ad-hoc invocation today</span>
          <span className="text-[11px] text-mute">— no continuously running aggregator service in this deployment</span>
        </div>
        <p className="text-mute text-[12px] leading-relaxed">
          Today the aggregator runs on demand via{" "}
          <code className="text-paper">circuits/aggregator/build.sh</code> — produces one outer
          proof from K queued inner proofs, then exits. The panel below shows what a
          continuously running service would expose to its operators: pending-K-fill bar,
          throughput sparkline, tree-composition depth indicator. Mock values shown.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line">
          <OpsPanel label="K-fill (next batch)" value="0 / 4" detail="awaiting inner proofs" />
          <OpsPanel label="throughput · last hour" value="—" detail="ops/min" />
          <OpsPanel label="root cost · last verify" value={`${RECURSIVE_FEE.toLocaleString()} stroops`} detail={`ledger ${RECURSIVE_LEDGER.toLocaleString()}`} />
        </div>
      </div>
    </section>
  );
}

function OpsPanel({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-ink p-4 space-y-1">
      <div className="text-[11px] uppercase tracking-[0.08em] text-mute">{label}</div>
      <div className="text-paper text-lg">{value}</div>
      <div className="text-[11px] text-mute">{detail}</div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────
function SectionHeading({ n, title, caption }: { n: string; title: string; caption: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap pb-2 border-b border-line">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-mute">{n}</span>
        <h2 className="font-mono text-paper text-base uppercase tracking-[0.08em]">{title}</h2>
      </div>
      <span className="font-mono text-[11px] text-mute">{caption}</span>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-3 text-[12px]">
      <span className="text-mute uppercase tracking-[0.08em]">{k}</span>
      <span className="break-all">{v}</span>
    </div>
  );
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}

function pctSaved(naive: number, recursive: number): string {
  if (naive <= 0) return "—";
  if (recursive >= naive) return `0%`;
  return `${Math.round(((naive - recursive) / naive) * 100)}%`;
}

interface AggStats {
  depth: number;
  aggregatorProofs: number;
  innerProveMs: number;
  aggProveMs: number;
  proveMs: number;
}

// Sum of geometric series 1 + K + K^2 + ... + K^(d-1) = (K^d - 1) / (K - 1).
function computeAggregation(N: number, k: number): AggStats {
  if (N <= 1) {
    return { depth: 0, aggregatorProofs: 0, innerProveMs: 5_000, aggProveMs: 0, proveMs: 5_000 };
  }
  const depth = Math.ceil(Math.log(N) / Math.log(k));
  // exact leaf count for depth `depth` is k^depth; assume padding to that
  // (real tree composition pads with dummy proofs when N isn't a power of k).
  const leaves = Math.pow(k, depth);
  const aggregatorProofs = (leaves - 1) / (k - 1);
  // measured baselines (~5s per inner Pedersen-Merkle proof, ~30s per
  // aggregator outer proof; bb CRS download is cached after first run)
  const innerProveMs = N * 5_000;
  const aggProveMs = aggregatorProofs * 30_000;
  return { depth, aggregatorProofs, innerProveMs, aggProveMs, proveMs: innerProveMs + aggProveMs };
}
