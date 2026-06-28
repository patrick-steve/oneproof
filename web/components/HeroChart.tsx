"use client";

// design.md §1 + §4 + §5 — the signature scrubbable instrument.
// Hand-rolled SVG so we control the exact line/grid/glow without a chart-lib
// dep. Per §4: foil (naive, coral) climbs steeply and EXITS the frame at
// high N; signal (aggregated, teal) stays flat. The slider is keyboard-
// operable per §6 accessibility.

import { useMemo, useState } from "react";
import { projectStroops, isMeasured, type Mode } from "@/lib/bench";
import { COLORS } from "@/lib/colors";

const N_MIN = 1;
const N_MAX = 1024;
const N_DEFAULT = 64;

const PAD = { top: 24, right: 36, bottom: 44, left: 56 };
const W = 720;
const H = 320;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function chartScales(maxStroops: number) {
  const xScale = (n: number) => PAD.left + ((n - N_MIN) / (N_MAX - N_MIN)) * (W - PAD.left - PAD.right);
  const yScale = (s: number) => PAD.top + (1 - Math.min(s / maxStroops, 1.05)) * (H - PAD.top - PAD.bottom);
  return { xScale, yScale };
}

function polylineFor(mode: Mode, xScale: (n: number) => number, yScale: (s: number) => number, sampleN: number[]) {
  // Sample the projection densely so curves look smooth.
  return sampleN.map((n) => `${xScale(n).toFixed(2)},${yScale(projectStroops(mode, n)).toFixed(2)}`).join(" ");
}

function formatStroops(s: number): string {
  if (s >= 1_000_000) return `${(s / 1_000_000).toFixed(2)} M`;
  if (s >= 1_000) return `${(s / 1_000).toFixed(1)} K`;
  return s.toLocaleString();
}

export default function HeroChart() {
  const [n, setN] = useState(N_DEFAULT);

  // We clamp the y-axis to ~the recursive line × 8 so the naive line gets to
  // explode off the top dramatically — per §4 "the explosion is the point".
  // Use a fixed scale rather than dynamic so the slider feels stable.
  const yMax = useMemo(() => projectStroops("recursive", 4) * 8, []);
  const { xScale, yScale } = chartScales(yMax);

  // Dense sampling for curves
  const sampleN = useMemo(() => {
    const arr: number[] = [];
    for (let i = N_MIN; i <= N_MAX; i += Math.max(1, Math.floor(N_MAX / 200))) arr.push(i);
    if (arr[arr.length - 1] !== N_MAX) arr.push(N_MAX);
    return arr;
  }, []);

  const sNaive     = projectStroops("naive",     n);
  const sBatch     = projectStroops("batch",     n);
  const sRecursive = projectStroops("recursive", n);

  return (
    <div className="border border-line bg-ink-2 p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-4">
        <div className="label text-mute">on-chain cost · stroops</div>
        <div className="label text-mute">N = {n.toString().padStart(4, " ")}</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cost vs N chart">
        {/* horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map((t) => {
          const y = lerp(PAD.top, H - PAD.bottom, 1 - t);
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={COLORS.line} strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 3} fill={COLORS.mute} fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
                {formatStroops(Math.round(yMax * t))}
              </text>
            </g>
          );
        })}

        {/* x-axis ticks */}
        {[1, 64, 256, 512, 1024].map((nn) => (
          <g key={nn}>
            <line x1={xScale(nn)} y1={H - PAD.bottom} x2={xScale(nn)} y2={H - PAD.bottom + 4} stroke={COLORS.line} strokeWidth="1" />
            <text x={xScale(nn)} y={H - PAD.bottom + 16} fill={COLORS.mute} fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">
              {nn}
            </text>
          </g>
        ))}
        <text x={W / 2} y={H - 6} fill={COLORS.mute} fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle" letterSpacing="0.08em">
          N · NUMBER OF PRIVATE OPERATIONS
        </text>

        {/* Naive (foil) — climbing and exiting the frame */}
        <polyline points={polylineFor("naive", xScale, yScale, sampleN)} fill="none" stroke={COLORS.foil} strokeWidth="2" strokeLinejoin="round" />
        {/* Batch (a quieter projected line — uses signal-dim) */}
        <polyline points={polylineFor("batch", xScale, yScale, sampleN)} fill="none" stroke={COLORS.signalDim} strokeWidth="2" strokeLinejoin="round" strokeDasharray="2 4" opacity="0.85" />
        {/* Recursive (signal) — the flat line, the hero */}
        <polyline points={polylineFor("recursive", xScale, yScale, sampleN)} fill="none" stroke={COLORS.signal} strokeWidth="2.5" strokeLinejoin="round" />

        {/* Measured-point markers at N=4 (the row we actually ran) */}
        {(["naive", "batch", "recursive"] as Mode[]).map((mode) => {
          if (!isMeasured(mode, 4)) return null;
          const color = mode === "naive" ? COLORS.foil : mode === "recursive" ? COLORS.signal : COLORS.mute;
          return (
            <circle key={mode} cx={xScale(4)} cy={yScale(projectStroops(mode, 4))} r="3.5" fill={color} stroke={COLORS.ink} strokeWidth="1.5" />
          );
        })}

        {/* Scrub cursor: vertical line at current N + 3 dots */}
        <line x1={xScale(n)} y1={PAD.top} x2={xScale(n)} y2={H - PAD.bottom} stroke={COLORS.paper} strokeWidth="0.5" opacity="0.4" />
        <circle cx={xScale(n)} cy={yScale(sNaive)} r="4.5" fill={COLORS.foil} stroke={COLORS.ink} strokeWidth="1.5" />
        <circle cx={xScale(n)} cy={yScale(sBatch)} r="3.5" fill={COLORS.signalDim} stroke={COLORS.signal} strokeWidth="1.5" />
        <circle cx={xScale(n)} cy={yScale(sRecursive)} r="4.5" fill={COLORS.signal} stroke={COLORS.ink} strokeWidth="1.5" />
      </svg>

      {/* Slider */}
      <div className="mt-6 flex items-center gap-4">
        <label htmlFor="n-slider" className="label text-mute shrink-0">N</label>
        <input
          id="n-slider"
          type="range"
          min={N_MIN}
          max={N_MAX}
          value={n}
          onChange={(e) => setN(parseInt(e.target.value, 10))}
          aria-valuenow={n}
          aria-valuemin={N_MIN}
          aria-valuemax={N_MAX}
          className="w-full accent-signal"
        />
        <span className="font-mono text-paper text-base shrink-0 w-16 text-right">{n}</span>
      </div>

      {/* Readouts */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-sm">
        <div className="border border-line p-3">
          <div className="label">naive · N txs</div>
          <div className="text-foil mt-1">{formatStroops(sNaive)}</div>
        </div>
        <div className="border border-line p-3">
          <div className="label">batched · 1 tx</div>
          <div className="text-paper mt-1">{formatStroops(sBatch)}</div>
        </div>
        <div className="border border-line p-3">
          <div className="label">recursive · 1 tx</div>
          <div className="text-signal mt-1">{formatStroops(sRecursive)}</div>
        </div>
      </div>

      <p className="text-mute text-sm mt-5 leading-relaxed">
        Measured at <span className="font-mono text-paper">N = 4</span> on Stellar testnet (dots above). The
        recursive line is structurally flat: one outer UltraHonk verify regardless of how many inner proofs
        it aggregates. The naive line is linear: every proof is its own transaction. Drag the slider — the
        chain doesn&apos;t care how many proofs are inside.
      </p>
    </div>
  );
}
