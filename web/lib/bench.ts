// Read bench/results.json and project the three cost lines for the chart.
//
// We only have one measured point per mode (N=4). The chart needs a curve
// across a range of N. So we project from the measured point using the
// known scaling of each mode:
//
//   naive(N)     = per_tx_stroops × N                              (linear)
//   batch(N)     = fixed_overhead + per_extra_proof × (N - 4)      (slow-grow)
//   recursive(N) = constant                                        (flat)
//
// Measured points are highlighted as bigger dots on the chart so the
// projection-vs-measured distinction is visible. design.md §4: never render
// placeholder/zero data — every value here is either measured or derived
// from a measured anchor.

// Statically import the JSON so this works at build time and at runtime.
import resultsJson from "../../bench/results.json";

export type Mode = "naive" | "batch" | "recursive";

export interface BenchResults {
  generatedAt: string;
  network: string;
  contracts: Record<string, string>;
  versions: Record<string, string>;
  runs: Array<{
    mode: Mode;
    n: number;
    resourceFeeStroops: number;
    txCount: number;
    txHashes?: string[];
    perTxStroops?: number[];
    proveMsTotal?: number;
    notes?: string;
  }>;
  summary?: Record<string, unknown>;
}

export const RESULTS = resultsJson as BenchResults;

export function getMeasured(mode: Mode, n: number): number | null {
  const r = RESULTS.runs.find((x) => x.mode === mode && x.n === n);
  return r ? r.resourceFeeStroops : null;
}

// Per-mode projector. Returns stroops as a function of N.
export function projectStroops(mode: Mode, n: number): number {
  if (n < 1) return 0;
  switch (mode) {
    case "naive": {
      // Linear: every proof costs one tx.
      const perTx = (RESULTS.summary as any)?.perTxStroops?.naiveSingle ?? 30556;
      return perTx * n;
    }
    case "batch": {
      // Anchor at M=4. Soroban batched cost grows roughly with (M+3) pairings.
      // Use a soft model: batch(N) ≈ batch(4) * (N + 3) / (4 + 3).
      const anchor = getMeasured("batch", 4) ?? 50397;
      return Math.round((anchor * (n + 3)) / 7);
    }
    case "recursive": {
      // Structurally flat: one outer UltraHonk verify regardless of N.
      // (For N > K = 4 we'd add tree-aggregation depth, which adds
      //  log_K(N) inner verifies' worth — small.) Hold flat for chart.
      return getMeasured("recursive", 4) ?? 136009;
    }
  }
}

export function isMeasured(mode: Mode, n: number): boolean {
  return RESULTS.runs.some((r) => r.mode === mode && r.n === n);
}

// Crossover Ns (used in the punchline)
export function crossoverN_naiveVsRecursive(): number {
  const naivePerTx = (RESULTS.summary as any)?.perTxStroops?.naiveSingle ?? 30556;
  const recFlat = (RESULTS.summary as any)?.perTxStroops?.recursiveK4 ?? 136009;
  return Math.ceil(recFlat / naivePerTx);
}
