# OneProof – implement.md

Engineering handoff for Claude Code. Build in the order written. Each tier is a checkpoint; do not start a tier until the previous one is green and committed. Read `build.md` first – it governs scope and the risk ladder. This file is the how.

Conventions: en dashes with spaces ( – ), never em dashes. No placeholders. Where a version or address is not yet known, the step says to determine and pin it – do that, then write the value back into this file. Do not invent values. If a real input is genuinely missing and cannot be derived, stop and ask rather than fabricate.

---

## §0. Constants and toolchain (pin these in step 0.1, then treat as fixed)

Single source of truth for the project name and identifiers. Change the name here only.

```
PROJECT_NAME      = "OneProof"
PROJECT_SLUG      = "oneproof"
NETWORK           = "testnet"            # Stellar testnet throughout; never mainnet
INNER_PROOF_SYS   = "UltraHonk (Noir/Barretenberg)"   # recursion track
BATCH_PROOF_SYS   = "Groth16 (Circom/snarkjs)"        # batch/MSM track
```

**Toolchain – do not guess versions. Install via the version managers and pin whatever they resolve, because Noir↔bb compatibility is version-sensitive and a mismatch is the single most common way this build stalls.**

```
0.1  Install and pin, recording exact resolved versions back into this block:
     - noirup → nargo            (record version: __PIN_HERE__)
     - bbup   → bb (Barretenberg)(record version: __PIN_HERE__; MUST match the nargo it pairs with)
     - rustup → rust stable      (record version: __PIN_HERE__)
     - stellar-cli (soroban)     (record version: __PIN_HERE__)
     - node ≥ 20, pnpm           (record versions: __PIN_HERE__)
     - circom 2.x, snarkjs       (record versions: __PIN_HERE__)
```

The `__PIN_HERE__` tokens are the only blanks in this document and they exist to be filled by running the installer in step 0.1 – they are recorded facts, not placeholders for design decisions.

**Forks to vendor (clone into `/vendor`, pin commit SHAs):**

```
- UltraHonk Soroban verifier:  yugocabrio/rs-soroban-ultrahonk      (pin SHA)
- Groth16 Soroban verifier:    stellar/soroban-examples /groth16_verifier  (pin SHA)
- Reference E2E tutorials (read, do not vendor):
    jamesbachini.com/noir-on-stellar      (Noir → Soroban path)
    jamesbachini.com/circom-on-stellar    (Circom/Groth16 → Soroban path)
```

## §1. Repository structure

```
oneproof/
  vendor/                          # pinned forks (read-only to us; we adapt copies)
  circuits/
    inner_transfer/                # Noir: private transfer (Poseidon + Merkle + nullifier)
      src/main.nr
      Nargo.toml
    aggregator/                    # Noir: recursive verification, K inner proofs → 1
      src/main.nr
      Nargo.toml
    groth16_batch/                 # Circom: inner circuit for the batch track
      circuit.circom
  contracts/
    oneproof_verifier/            # Soroban: verifies the outer UltraHonk proof
      src/lib.rs
      Cargo.toml
    groth16_batch_verifier/        # Soroban: batch-verify M Groth16 proofs via MSM
      src/lib.rs
      Cargo.toml
  prover/                          # TS service: orchestrate inner proving + tree aggregation
    src/
      proveInner.ts
      aggregate.ts                 # K-to-1 and tree composition
      submit.ts                    # build + send Soroban tx, read resource cost
      index.ts                     # CLI entry: oneproof prove --n <N> --mode <mode>
    package.json
  bench/
    runBench.ts                    # runs {naive, batch, recursive} × N, writes results.json
    results.json                   # committed artifact the dashboard reads
  web/                             # Next.js landing + live dashboard (see design.md)
  scripts/
    build.sh  prove.sh  deploy.sh  bench.sh
  README.md
```

## §2. Tier 0 – toolchain spike (BLOCKING, do first)

Goal: prove the hero is reachable before writing product code. Two independent checks; both must pass.

```
2.1  Noir recursion check (off-chain):
     - Build the canonical Noir recursive-proof example for the pinned nargo/bb:
       an inner circuit, and an aggregator circuit that verifies the inner proof
       via std::verify_proof, producing an outer proof.
     - Generate inner proof, feed it to the aggregator, generate the outer proof,
       verify the outer proof off-chain with bb.
     - GREEN if the outer proof verifies. If the pinned versions cannot recurse,
       try the nearest compatible nargo/bb pair documented by Noir, re-pin, retry.

2.2  Soroban UltraHonk verify check (on-chain):
     - From vendor/rs-soroban-ultrahonk, deploy the verifier to testnet.
     - Generate ONE non-recursive UltraHonk proof from a trivial Noir circuit,
       feed it to the deployed contract, confirm it verifies on-chain.
     - GREEN if the testnet tx returns success.

2.3  Decision gate:
     - Both green  → proceed to Tier 1, then Tier 2 (full plan).
     - 2.2 green, 2.1 red → recursion infeasible on this stack. Drop Tier 2.
       Ship Tier 1 (batch) as the submission. Update build.md success criteria
       to "minimum" and tell the user explicitly.
     - 2.2 red → the on-chain verify path is broken; fix before anything else,
       this blocks every tier.
```

Commit the spike as `tier0-spike` with the resolved versions written into §0.

## §3. Tier 1 – batch verification (the floor, ships regardless)

### 3.1 Inner Circom circuit (`circuits/groth16_batch/circuit.circom`)
A small but real statement so the proofs are not trivial. Use the same private-transfer shape as the Noir inner circuit but in Circom: a Poseidon commitment `c = Poseidon(secret, amount, blinding)`, a Merkle membership of `c` in a depth-`D` tree (pin `D = 16`), and a nullifier `nf = Poseidon(secret, leafIndex)`. Public inputs: Merkle root, nullifier. Private: secret, amount, blinding, path. Run the Groth16 trusted setup (Powers of Tau + circuit-specific), commit the verifying key.

### 3.2 Batch verifier contract (`contracts/groth16_batch_verifier`)
Adapt the vendored Stellar Groth16 verifier to verify M proofs sharing one verifying key in a single call, via random linear combination:

```
Given M proofs {(A_j, B_j, C_j, pub_j)} for verifying key vk:
  - Sample challenge scalars r_j = Poseidon(transcript, j)   (Fiat–Shamir; bind to all inputs)
  - Compute, with the BN254 MSM host function (Protocol 26):
       A* = Σ r_j · A_j
       C* = Σ r_j · C_j
       L* = Σ r_j · (Σ_i pub_{j,i} · IC_i)
  - Check the single batched pairing relation that the random combination
    collapses the M Groth16 equations into (one multi-pairing instead of M).
  - Accept iff the batched check holds.
```

Soundness: a forged proof passes the random combination with negligible probability over the r_j. The MSM is the host-function call – this is the line that makes the contract cheap and is the whole reason this is a Stellar project and not a generic one. Emit an event `BatchVerified{ count: M, root, nullifiers }`.

### 3.3 Result
Deploy to testnet. `bench` measures cost(naive, M) vs cost(batch, M). Tier 1 is a complete, submittable project on its own.

## §4. Tier 2 – recursive aggregation (the hero)

### 4.1 Inner Noir circuit (`circuits/inner_transfer/src/main.nr`)
Same statement as 3.1, in Noir: Poseidon commitment, Merkle membership (depth 16), nullifier. Public: root, nullifier. Private: secret, amount, blinding, Merkle path. Keep it minimal but real – fixed depth, single asset. Generate inner UltraHonk proofs with bb. These are the leaves.

### 4.2 Aggregator (`circuits/aggregator/src/main.nr`)
A Noir circuit that verifies `K` inner proofs using `std::verify_proof` and aggregates their verification into one outer proof. Pin `K = 4` for the base case. The aggregator's public inputs commit to the set of inner public inputs (the roots and nullifiers being aggregated) so the on-chain contract learns *what* was aggregated, not just that *something* was.

Tree composition (in `prover/aggregate.ts`): treat inner proofs as leaves; the aggregator verifies K children and emits one parent proof; recurse on parents until a single root proof remains. Depth = ceil(log_K(N)). For Tier 2 demo, N up to K² (one level of tree) is sufficient; Tier 3 pushes deeper.

### 4.3 Outer verifier contract (`contracts/oneproof_verifier`)
Adapt the vendored UltraHonk Soroban verifier to verify the single root proof. On success, store/emit `BatchVerified{ n: N, aggregatedPublicInputs }`. This is the one on-chain transaction whose cost we claim is flat in N.

### 4.4 Prover orchestration (`prover/`)
```
proveInner.ts   : input → inner UltraHonk proof (parallelizable across N)
aggregate.ts    : K-to-1 aggregation + tree composition → one root proof
submit.ts       : build Soroban tx, simulate to read resource cost, send, return
                  { txHash, cpuInstructions, resourceFeeStroops, success }
index.ts        : CLI – `oneproof prove --n <N> --mode <naive|batch|recursive>`
```

`submit.ts` must read **real** resource cost from the transaction simulation/result (CPU instructions and resource fee in stroops). These numbers are the product. Do not estimate them – read them from the network.

## §5. Benchmark harness (`bench/runBench.ts`)

For each mode in {naive, batch, recursive} and each N in a pinned sweep (e.g. [1, 2, 4, 8, 16, 32, 64, 128]):
- naive: submit N separate verify transactions, sum on-chain cost.
- batch: submit one batched Groth16 transaction (Tier 1 path).
- recursive: aggregate to one root proof, submit one transaction (Tier 2 path).
Record per (mode, N): on-chain CPU instructions, resource fee (stroops), number of transactions, off-chain proving wall-time. Write `bench/results.json`. The dashboard reads this file (and can also drive live single-N runs). Commit `results.json` so the demo works even if testnet is flaky during judging.

`results.json` shape:
```json
{
  "generatedAt": "<ISO timestamp>",
  "network": "testnet",
  "versions": { "nargo": "...", "bb": "...", "soroban": "..." },
  "runs": [
    { "mode": "naive",     "n": 64, "onchainCpu": 0, "resourceFeeStroops": 0, "txCount": 64, "proveMs": 0 },
    { "mode": "recursive", "n": 64, "onchainCpu": 0, "resourceFeeStroops": 0, "txCount": 1,  "proveMs": 0 }
  ]
}
```
(Zeros above are the schema shape; the harness fills real measured values. Never ship zeros – if a run did not execute, omit it.)

## §6. Tier 3 – scale and portability (stretch, only after Tier 2 green)

- **Scale:** push tree aggregation to N in the hundreds/thousands; show the recursive line stays flat while naive is off the chart. Parallelize inner proving.
- **Portability:** take one Groth16 proof from the batch track and verify it on (a) an EVM Groth16 verifier (local hardhat/anvil) and (b) the Stellar Groth16 verifier – same proof, two chains, both accept. Add a small "verified on Ethereum ✓ / verified on Stellar ✓" panel and a gas/cost comparison. This demonstrates BN254 proof portability without building a bridge.

## §7. Deployment

- Contracts: `scripts/deploy.sh` builds and deploys both Soroban contracts to testnet, writes deployed contract IDs into `web/.env.local` and back into this file's §0 block (record them, do not leave blank).
- Web: Next.js app deploys to Vercel. Dashboard reads `bench/results.json` for the static curve and calls the prover/submit path for live single-N runs.
- README: one-command reproduce – clone, install pinned toolchain, `scripts/build.sh && scripts/deploy.sh && scripts/bench.sh`, then `pnpm dev` in `web/`.

## §8. Build order checklist

```
[ ] 0  pin toolchain + vendor forks (commit: tier0-setup)
[ ] 0  Tier 0 spike: 2.1 recursion green, 2.2 on-chain verify green (commit: tier0-spike)
[ ] 1  Circom inner circuit + trusted setup
[ ] 1  batch Groth16 Soroban verifier (MSM), deploy testnet
[ ] 1  bench naive vs batch  → results.json  (commit: tier1-batch)  ← submittable here
[ ] 2  Noir inner transfer circuit, inner proofs
[ ] 2  Noir aggregator (K=4), outer proof off-chain
[ ] 2  UltraHonk Soroban outer verifier, deploy testnet
[ ] 2  prover orchestration + submit cost-reading
[ ] 2  bench adds recursive (flat) line  (commit: tier2-recursive)  ← target submission
[ ] 3  tree scale to large N
[ ] 3  EVM↔Stellar Groth16 portability panel  (commit: tier3-stretch)
[ ] –  web landing + dashboard per design.md, deploy Vercel
[ ] –  README reproduce path verified clean-clone
```

## §9. Failure modes and what to do

- **nargo/bb mismatch** (most likely stall): re-pin to a documented-compatible pair; the Noir release notes state which bb each nargo targets. Do not proceed past Tier 0 until the recursion example verifies.
- **UltraHonk proof too large / verify too costly on Soroban:** acceptable – that *is* a finding. Report it on the dashboard. The recursive line being flat-but-high still beats naive at modest N; show the crossover point.
- **Testnet flaky during judging:** `results.json` is committed; the dashboard renders the curve from it without a live network. Live runs are a bonus, not a dependency.
- **Recursion infeasible on the stack:** Tier 0 catches this on day one. Fall back to Tier 1, which is a complete submission. This is the entire reason for the ladder.
