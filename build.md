# OneProof – build.md

> One proof to rule them all. Constant-cost ZK on Stellar.

This is the canonical document for the project: what it is, why it exists, how it is shaped, what we are scoping in and out, and how we win. `implement.md` is the engineering handoff. `design.md` is the landing page. This file governs both – if they disagree, this file wins.

The name is OneProof, tagline "one proof to rule them all" – N proofs collapse into the one proof the chain verifies. It is defined in exactly one constant and one set of brand tokens (`implement.md` §0, `design.md` §1); everywhere else refers to it by that constant, so a future rename touches two places only.

---

## 1. The problem

On-chain proof verification is the cost ceiling for private applications. Every private transfer, every compliance check, every confidential vote is one ZK proof that some contract must verify on-chain. The proof generation is off-chain and cheap to scale. The verification is on-chain and is the part that does not scale: verifying N proofs costs roughly N times the per-proof on-chain cost. A private payments app processing a thousand transfers pays for a thousand on-chain verifications. That linear wall is why most "private app on chain X" demos never get past single-digit throughput.

Stellar specifically has just spent two protocol releases (Protocol 25 "X-Ray", Protocol 26 "Yardstick") building the host functions that make SNARK verification cheap on-chain – BN254 curve ops, Poseidon/Poseidon2, multi-scalar multiplication, scalar-field arithmetic, curve-membership checks. The brief itself names the gap: powerful primitives exist, but they do not by themselves give you a scalable private application. Closing that gap is the project.

## 2. The thesis

Make on-chain verification cost **constant in N** instead of linear, by aggregating proofs off-chain into a single proof the chain verifies once.

Two mechanisms get you there, and we ship both as a ladder:

- **Batch verification** – verify N independent proofs in a *single* on-chain call using a random linear combination collapsed into one multi-scalar multiplication and one multi-pairing check. On-chain cost grows sub-linearly in N (one MSM over N points, not N separate pairing checks). This is exactly what Protocol 26's MSM host function is for. Guaranteed to work; this is the floor.
- **Recursive aggregation** – an outer proof attests that N inner proofs were verified off-chain. The chain verifies one outer proof. On-chain cost is **flat** in N – ten proofs or ten thousand, same on-chain cost. This is the hero, and it is the thing the flat line on the benchmark chart sells in one glance.

The headline claim, stated honestly: *OneProof makes the on-chain cost of a private app independent of how many private operations it processes.* That is a real infrastructure result, it uses Stellar's newest primitives at the deepest level, and it sits precisely in the primitives-to-product gap the brief points at.

## 3. Why now (and why this is on-thesis for the judges)

The judges shipped the MSM host functions in Protocol 26 and are proud of them. Aggregation is the canonical, intended use of MSM. We are the team that takes their newest toys and uses them for the exact thing they were built for, at the layer where they matter most. Every other strong direction (private remittance, on-chain identity, cross-chain bridge) is an *application* that consumes verification. OneProof is the *infrastructure* that makes all of those cheaper. It is the only direction whose hard problem, once solved, produces something that did not exist on Stellar before and that every other private app on Stellar would want.

It is also the only direction with **zero trust dependency to forgive**. There is no anchor to mock, no government issuer to fake, no cross-chain relayer to hand-wave. The inner proofs are real, the aggregation is real, the on-chain savings are real and measured. Everything on screen is genuine. That is a cleaner story than any application-layer alternative.

## 4. What it is, concretely

OneProof is four things that compose into one demo:

1. **An inner workload** – a real private-transfer circuit (Poseidon note commitment, Merkle membership, nullifier). Each transfer is one inner proof. This is deliberately a money-movement workload so that what we are aggregating ties to Stellar's identity, not an abstract toy.
2. **An aggregator** – a recursion circuit that verifies K inner proofs and emits a single outer proof. For large N, the aggregator composes as a tree (verify K children, emit one parent, repeat to a root), so one root proof covers all N at log-depth.
3. **An on-chain verifier** – a Soroban contract that verifies the single outer proof using the BN254/Poseidon host functions, then records "this batch of N operations is verified" on-chain.
4. **A benchmark + live dashboard** – measures real Soroban resource cost (CPU instructions and resource fee) for three modes – naive N-separate verifications, batched, and recursively aggregated – and plots cost against N. The flat aggregation line against the rising naive line is the hero visual and the whole pitch in one chart.

## 5. Architecture

```
   off-chain (prover side)                         on-chain (Stellar testnet)
   ─────────────────────────                       ──────────────────────────
   N private-transfer inputs
            │
            ▼
   ┌─────────────────────┐   inner UltraHonk proofs (×N)
   │ inner circuit (Noir)│ ───────────────┐
   └─────────────────────┘                │
                                          ▼
                          ┌────────────────────────────────┐
                          │ aggregator (Noir recursion)     │
                          │  verifies K children → 1 parent │
                          │  composed as a tree to a root   │
                          └────────────────────────────────┘
                                          │  one root proof
                                          ▼
                          ┌────────────────────────────────┐
                          │ Soroban verifier contract       │
                          │  BN254 + Poseidon host fns       │  ← Protocol 25/26
                          │  verify(root) → record batch     │
                          └────────────────────────────────┘
                                          │
                                          ▼
                                  benchmark harness
                          measures CPU instrs + resource fee
                          for {naive, batch, recursive} × N
                                          │
                                          ▼
                                  web dashboard (cost vs N)
```

Parallel **batch track** (the floor): a Circom/Groth16 inner circuit, a Soroban contract that batch-verifies M Groth16 proofs in one call via random-linear-combination + MSM host function. This track is independent of the recursion track and is the guaranteed-shippable result that also doubles as a baseline on the benchmark.

## 6. The build ladder (this is the risk strategy)

Each tier is independently demoable. We climb only after the tier below is green. This guarantees we finish with *something* real and removes the "discovered the hero was infeasible on day three" failure.

- **Tier 0 – toolchain spike (day 1, blocking).** Get the published Noir recursion example proving and verifying end-to-end on the exact pinned `nargo`/`bb` versions, and get the forked UltraHonk Soroban verifier to accept a single non-recursive UltraHonk proof on testnet. Green light = both pass. This de-risks the entire hero before any product code is written. If recursion in the stack turns out infeasible, we find out here, on day one, and the project becomes Tier 1 only – still a real, shippable result.
- **Tier 1 – batch verification (the floor).** Circom inner circuit + Soroban batch-Groth16 verifier using MSM. Benchmark naive vs batch. Ships regardless of whether recursion works. This alone is a legitimate hackathon submission.
- **Tier 2 – recursive aggregation (the hero).** Noir inner transfer circuit + Noir aggregator (K-to-1) + Soroban UltraHonk verifier for the outer proof. Benchmark adds the flat recursive line. This is the headline.
- **Tier 3 – scale + portability (stretch).** Tree aggregation to large N (hundreds/thousands of inner proofs into one root). Portability gesture: the same Groth16 proof verifying on both an EVM verifier and the Stellar Groth16 verifier, demonstrating BN254 proof portability across ecosystems.

Tier 1 + Tier 2 is the target submission. Tier 0 must pass for Tier 2 to be attempted. Tier 3 is bonus.

## 7. The demo (three minutes)

1. Dashboard. User sets N with a slider (say N = 64).
2. OneProof generates N private-transfer proofs (progress bar), aggregates them into one root proof (tree animation), submits one transaction to Stellar testnet.
3. On confirmation: transaction hash (link to explorer), the on-chain cost of *that one transaction*, and the cost-vs-N chart updating live.
4. The punchline: drag N from 64 to 1,024. The naive line rockets up. The recursive line stays flat. One sentence: "Same on-chain cost. The chain does not care how many private operations are inside."

The benchmark is the hero, so it is engineered as a hero, not bolted on. See `design.md` §4.

## 8. Scope – explicitly in and out

**In:** inner transfer circuit (real but minimal – fixed Merkle depth, single asset), Noir aggregator (K-to-1, plus tree for Tier 3), Soroban UltraHonk verifier (forked), Soroban batch-Groth16 verifier (MSM), benchmark harness producing real resource numbers from testnet, Next.js dashboard + landing page.

**Out:** production anonymity set, real fiat ramps, real wallet custody, a general-purpose "aggregate any circuit" SDK, formal soundness proofs of our composition, a relayer network, multi-asset support, mainnet. We are demonstrating the *mechanism and the cost curve*, not shipping a product. Say this out loud in the README and the pitch – it is a strength, not an apology.

## 9. Honest caveats (state these before a judge does)

- **Anonymity set is demo-sized.** We demonstrate the aggregation mechanism and the cost scaling, not a deployed anonymity set. The privacy of the inner transfers is real cryptographically; the set is small because it is a demo.
- **We compose audited components, we do not roll new crypto.** Recursive soundness rests on Barretenberg's recursive UltraHonk verifier and the forked Soroban verifier. Our contribution is the aggregation architecture and the on-chain cost result, not a new proof system.
- **Honk needs no per-circuit trusted setup** (universal SRS) – call this out as a real advantage of the Noir/UltraHonk path over the Groth16 batch track, which needs a per-circuit setup.
- **"Constant cost" is constant *on-chain*.** Off-chain proving cost grows with N (that is where the work moves). The claim is precisely that the *chain's* cost is independent of N, which is the cost that actually bottlenecks on-chain apps. Do not let the claim slip into "free" – it is "moved off-chain and amortized."

## 10. Success criteria

- **Minimum (must hit):** Tier 1 shipped. One Soroban transaction batch-verifies M Groth16 proofs via MSM, with a benchmark showing it beats M naive verifications. Deployed to testnet, reproducible from the repo.
- **Target (the submission we want):** Tier 0 green + Tier 2 shipped. A single Soroban transaction verifies one recursive proof aggregating N real private-transfer proofs, on-chain cost measured and flat across N, live dashboard, deployed landing page.
- **Stretch:** Tier 3 – tree aggregation to N in the hundreds/thousands, and the EVM↔Stellar portability demo.

## 11. Judging fit (why this scores)

- **Primitives gap:** lands exactly where the brief says the interesting projects live.
- **ZK does real work:** the proof *is* the load-bearing component – remove it and the cost result vanishes. Nothing is namechecked.
- **Newest-primitives showcase:** MSM (Protocol 26) is used for its canonical purpose; this flatters the work the judges just did.
- **Infrastructure leverage:** every other private app on Stellar benefits from this, which is a bigger claim than any single application.
- **Honest and measured:** real testnet numbers, stated caveats, no oversell. Judges trust a team that names its own limits.

## 12. Formatting conventions for all project docs

En dashes with spaces ( – ), never em dashes. No placeholders – if a value is unknown, the doc says "determine in step X and pin it", which is an instruction, not a blank. Code and versions are pinned during the Tier 0 setup and recorded back into `implement.md` §0.
