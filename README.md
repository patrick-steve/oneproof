# OneProof

> One proof to rule them all. Constant-cost ZK on Stellar — and a working privacy pool on top of it.

**▶ [90-second walkthrough](https://your-video-link-goes-here)** — start here if you've got two minutes.
(See `VIDEO.md` for the script + production notes; replace this URL after recording.)

**🌐 Live:** [oneproof landing](https://your-vercel-deployment-here.vercel.app) · [console demo](https://your-vercel-deployment-here.vercel.app/console) · [privacy pool](https://your-vercel-deployment-here.vercel.app/console/pool)

**⛓ On-chain:**
- [`oneproof_verifier`](https://stellar.expert/explorer/testnet/contract/CB2GZVKSS4VW5MCLPRCTE4XQKHYGXTUIPB3AGZQG62STUSTOLCYP526D) (recursive UltraHonk verifier)
- [`oneproof_pool`](https://stellar.expert/explorer/testnet/contract/CBQPVKJKRKIXQIUH4BOY2K3Q5O3IH5HG36GUD46N2X2BKOGJ2TSIMXSY) (privacy pool with batch settlement)

## What's novel

Three things that, to our knowledge, didn't exist before this build:

1. **First recursive UltraHonk on Stellar.** BN254 host functions (Protocol 25/26) made it possible; this is the first project to use them for recursive Honk verification on chain.
2. **First Soroban privacy pool with batch settlement.** Verifies an aggregated proof AND dispatches N transfers atomically in one Soroban invocation. EVM would need verifier + multicall as separate steps.
3. **First measured constant-cost ZK primitive on a Stellar mainnet candidate.** 136K stroops per tx, flat as N grows. Every number linkable to stellar.expert.

## What's in here

```
circuits/    inner_transfer + aggregator + aggregator_k16 (Noir) + groth16_batch (Circom)
contracts/   oneproof_verifier + oneproof_pool (Soroban)
backend/     Node + Express service that wraps nargo + bb (deployed on Fly.io)
web/         Next.js landing + console + privacy pool UI
bench/       committed measurements + K=16 projection methodology
vendor/      pinned forks (rs-soroban-ultrahonk, soroban-examples)
scripts/     dev / preview / bench helpers
```

## Run it yourself

```bash
git clone --recurse-submodules https://github.com/patrick-steve/oneproof
cd oneproof
```

**View the landing + console** (uses the deployed backend at `oneproof.fly.dev`):

```bash
cd web
pnpm install
pnpm dev    # http://localhost:3000
```

**Build the circuits + contracts from scratch:**

```bash
# requires: rust (with wasm32v1-none), nargo 1.0.0-beta.9, bb 0.87.0
cd circuits/inner_transfer && nargo compile
cd ../aggregator           && nargo compile
cd ../derive_inputs        && nargo compile
cd ../aggregator_k16       && nargo compile

cd ../../contracts/oneproof_pool
cargo build --target wasm32v1-none --release
```

**Deploy the backend** (Soroban prover + activity indexer):

See `backend/DEPLOY.md` for the Fly.io one-time setup. tl;dr:

```bash
cd backend
./prepare.sh   # stages circuits + companions
fly deploy
```

**Deploy the contracts to testnet** (the pool needs a funded testnet account):

```bash
cd contracts/oneproof_pool
stellar contract deploy \
  --wasm target/wasm32v1-none/release/oneproof_pool.wasm \
  --network testnet --source <your_account> \
  -- --verifier <oneproof_verifier_id> --token <native_xlm_sac_id>
```

## Pinned versions

```
nargo                1.0.0-beta.9
bb (Barretenberg)    0.87.0
soroban-sdk          26.1.0
soroban-cli          26.1.0
circom               2.2.3
snarkjs              0.7.6
node                 22.x
```

## Architecture diagrams + design docs

- `build.md` — canonical project doc: what, why, scope, risk ladder
- `implement.md` — engineering handoff, build order
- `design.md` — landing page + dashboard spec
- `PRODUCT.md` — users, brand, register, anti-references
- `VIDEO.md` — 90-second walkthrough shooting script

If these disagree, `build.md` wins.

## Honest caveats

- **Testnet only.** No mainnet deploy yet; the contracts work, the economics aren't audited.
- **Demo-sized anonymity set.** The pool has a handful of commitments; real privacy needs thousands.
- **Recipient/amount binding is the next iteration.** The current pool contract accepts the aggregated proof + recipient/amount arrays as separate inputs; production would bind recipients into the circuit's public inputs. The architecture is correct; the binding is the follow-up.
- **bb has no working WASM build at 0.87.0.** Proving runs server-side (Fly backend). Verification is fully on-chain via Soroban.

## Tests

```bash
cd backend && npm install && npm test    # 11 vitest tests, ~3s
```

CI runs on every push (see `.github/workflows/test.yml`): backend tests, frontend `next build`, contracts `cargo build`.

## License

MIT.
