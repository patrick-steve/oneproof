// Shared Stellar testnet helpers for the /console surface.
//
// We use stellar.expert's public REST API (no auth, CORS-enabled) for
// human-readable operation lists. The @stellar/stellar-sdk dependency is
// available for Soroban RPC reads (decoding host-function args) where the
// REST API isn't enough.

import { RESULTS } from "@/lib/bench";

export const CONTRACTS = {
  oneproofVerifier: RESULTS.contracts.oneproof_verifier,
  groth16BatchVerifier: RESULTS.contracts.groth16_batch_verifier,
} as const;

export const NETWORK = {
  name: "testnet",
  passphrase: "Test SDF Network ; September 2015",
  sorobanRpc: "https://soroban-testnet.stellar.org",
  explorerBase: "https://stellar.expert/explorer/testnet",
  expertApi: "https://api.stellar.expert/explorer/testnet",
} as const;

export interface VerifyEvent {
  txHash: string;
  ledger: number;
  contractId: string;
  contractLabel: "oneproof" | "groth16-batch";
  function: string;          // e.g. "verify_proof" or "batch_verify" or "verify_one"
  successful: boolean;
  feeCharged: number;        // stroops
  timestamp: number;         // unix seconds
}

export function txUrl(hash: string): string {
  return `${NETWORK.explorerBase}/tx/${hash}`;
}

export function contractUrl(id: string): string {
  return `${NETWORK.explorerBase}/contract/${id}`;
}

export function shortHash(s: string, head = 8, tail = 6): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function ago(unixSec: number): string {
  const diff = Math.max(0, Date.now() / 1000 - unixSec);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Fetch the most recent verifies from our backend's activity indexer.
// Replaces an earlier attempt at hitting stellar.expert's REST API which
// turned out not to expose a per-contract operations endpoint, plus
// Soroban contracts that don't emit events (like ours) are invisible to
// getEvents. Our backend records every successful submit from /console,
// which is the actual interesting data anyway.
import { fetchActivity } from "@/lib/backend";

export async function fetchRecentVerifies(limit = 25): Promise<VerifyEvent[]> {
  const records = await fetchActivity(limit);
  return records
    .map((r) => ({
      txHash:        r.txHash,
      ledger:        r.ledger ?? 0,
      contractId:    r.contractId || CONTRACTS.oneproofVerifier,
      contractLabel: r.contractLabel,
      function:      r.function,
      successful:    true,
      feeCharged:    r.feeCharged ?? 0,
      timestamp:     r.timestamp,
    }))
    .filter((e) => e.txHash);
}

// Static fallback (always valid). When the live API is down we still want
// the console to render meaningful content rather than an empty state.
export function staticFallbackEvents(): VerifyEvent[] {
  const out: VerifyEvent[] = [];
  for (const r of RESULTS.runs) {
    if (!r.txHashes) continue;
    for (const tx of r.txHashes) {
      out.push({
        txHash: tx,
        ledger: (r as { ledger?: number }).ledger ?? 0,
        contractId: r.mode === "recursive" ? CONTRACTS.oneproofVerifier : CONTRACTS.groth16BatchVerifier,
        contractLabel: r.mode === "recursive" ? "oneproof" : "groth16-batch",
        function:
          r.mode === "recursive" ? "verify_proof" :
          r.mode === "batch"     ? "batch_verify" :
                                   "verify_one",
        successful: true,
        feeCharged: (r.perTxStroops?.[0]) ?? r.resourceFeeStroops,
        timestamp: Math.floor(new Date(RESULTS.generatedAt).getTime() / 1000),
      });
    }
  }
  return out;
}
