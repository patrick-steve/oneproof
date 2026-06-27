# circuits/groth16_batch — Tier 1 inner circuit

> implement.md §3.1. Same statement as the Noir inner circuit (§4.1)
> implemented in Circom so the batch and recursive tracks prove the
> same thing — naive/batched Groth16 vs recursive UltraHonk over an
> identical privacy-transfer claim. Apples-to-apples on the bench.

## Statement

```
public  : root, nullifier
private : secret, amount, blinding, pathElements[16], pathIndices[16]
constraints :
    c   = Poseidon(secret, amount, blinding)
    c   ∈ Merkle tree of depth 16 rooted at `root`
    leafIndex = Σ pathIndices[i] · 2^i
    nullifier = Poseidon(secret, leafIndex)
```

`D = 16` → 65,536 anonymity-set slots, ~9.4K R1CS constraints (well
under 2^14, so a `power_15` ptau is plenty).

## Layout

```
circuit.circom        the circuit
package.json          npm deps (circomlib, circomlibjs, tsx)
generate-input.ts     deterministic sanity input (secret=7, leafIndex=0)
input.json            generated input — sanity proves successfully
build.sh              full build pipeline (re-runnable, idempotent)
vkey.json             verifying key — COMMITTED, embedded by the on-chain verifier
target/               generated artifacts (gitignored): r1cs, wasm, zkey, ptau, proof, public
```

## Rebuild

```
./build.sh
```

Green = final line `=== TIER 1.1 GREEN: Circom inner circuit proves +
verifies off-chain ===`. Total time ~2 min cold (ptau download + setup),
~10 s warm.

## Trusted setup honesty

We use the **Hermez Powers of Tau** (`powersOfTau28_hez_final_15.ptau`),
a real multi-party ceremony output trusted by zkSNARK projects across
the ecosystem. On top of that we add a single demo contribution (no
multi-party round) for the circuit-specific zkey — adequate for a
demo, not production. Said out loud in `build.md` §9.

## Why some build details look weird

- `target/circuit_js/package.json` says `"type":"commonjs"`. circom
  emits `generate_witness.js` as CommonJS, but our top-level
  `package.json` declares `"type":"module"` (for ESM + tsx in
  `generate-input.ts`). The scoped override stops node from mistreating
  the generated file as ESM.
- ptau is downloaded from `storage.googleapis.com/zkevm/ptau/...`,
  not the original Hermez S3 bucket — that bucket has returned 403
  since ~2025. The GCS mirror is the current canonical location.
