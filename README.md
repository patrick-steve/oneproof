# OneProof

> One proof to rule them all. Constant-cost ZK on Stellar.

OneProof makes the on-chain cost of a private app independent of how many
private operations it processes, by aggregating proofs off-chain into a
single proof the chain verifies once.

## Documents

- `build.md`     – canonical project doc: what, why, scope, risk ladder.
- `implement.md` – engineering handoff. Build in the order written.
- `design.md`    – landing page + dashboard spec.

If these disagree, `build.md` wins.

## Repository layout

See `implement.md` §1. Top-level dirs:

- `circuits/`  inner transfer (Noir), aggregator (Noir), groth16_batch (Circom)
- `contracts/` Soroban verifiers (oneproof_verifier, groth16_batch_verifier)
- `prover/`    TS orchestration – prove, aggregate, submit, CLI
- `bench/`     benchmark harness + committed `results.json`
- `web/`       Next.js landing + dashboard (per design.md)
- `vendor/`    pinned forks (read-only to us; we adapt copies)
- `scripts/`   build / prove / deploy / bench wrappers

## Reproduce (target, once Tier 0 is green)

```
scripts/build.sh
scripts/deploy.sh
scripts/bench.sh
cd web && pnpm dev
```

Pinned versions and contract IDs live in `implement.md` §0.
