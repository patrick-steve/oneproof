# OneProof — PRODUCT.md

> Authored to satisfy the `impeccable` skill's product-context gate.
> Substantively a structured slice of `build.md`. If the two disagree,
> `build.md` wins.

## Register

**Mixed**:
- `web/app/page.tsx` (the landing at `/`) is **brand** — design IS the product, no shared task to complete with the user.
- `web/app/console/*` (the developer console at `/console`) is **product** — design serves a task (inspecting verifications, submitting proofs, watching the aggregator).

`impeccable` should load `reference/brand.md` when working in the
landing page, `reference/product.md` when working in the console.

## Users

- **Primary — Stellar Hackathon judges.** Want: real measurements, on-chain
  provenance, honest scope statements. Will look at the tx hashes. Will
  read the caveats. Will leave if the page is template-shaped.
- **Secondary — ZK-curious developers.** Want: code in the repo, a
  reproducible bench, clarity on which trade-offs are made (Pedersen vs
  Poseidon, Keccak FS, K=4 base case, etc.).
- **Tertiary — future integrators.** Want: a clean contract address they
  can verify against, a documented API, no surprises in the deployed wasm.

## Product purpose

Make the on-chain cost of ZK verification **constant in N** by aggregating
N proofs into one the chain verifies in a single transaction. The whole
project is a working demonstration of a non-trivial infrastructure result
on Stellar Protocol 25 and 26.

The console exists so a developer or judge can do three things without
leaving the page:

1. **Watch** verifications stream in against the live `oneproof_verifier`
   and `groth16_batch_verifier` contracts (Verify tab).
2. **Submit** a proof from their own wallet and see it accepted (or
   rejected) on testnet (Submit tab).
3. **Understand** what aggregation actually does — both as a measured
   result and as an interactive simulator across N (Aggregate tab).

## Brand

Aesthetic: **instrument panel / oscilloscope.** Calm, numeric, geometric.
Not crypto-launch. Not Stellar-space-imagery.

The two brand colors (signal teal `#4AD8C0`, foil coral `#FB7185`) ARE
the two chart lines that tell the story. JetBrains Mono is used for
every number, count, fee, address, and tx hash — that single rule is
what gives the surfaces their identity.

Full token system: `design.md` §1.

## Tone

A precise instrument, not a salesperson. Active voice, plain verbs,
sentence case in body, no hype words ("revolutionary", "seamless",
"unlock"). Numbers carry the persuasion; copy just points at them.
Caveats are stated plainly, not buried.

## Anti-references

What this surface should NOT look like:

- **Crypto launch sites.** Neon-on-black, glowing gradients, big-
  number-over-small-label hero, chromatic aberration on logos.
- **Generic SaaS.** Identical 3-column feature grid, illustrated
  mascot, "trusted by" logo soup.
- **Stellar default.** Space imagery — the most templated choice for
  anything on Stellar, deliberately avoided.
- **AI 3D demos.** Organic, photorealistic blobs in three.js. We want
  disciplined wireframe geometry.
- **Web3 wallet apps.** Big circular avatar, ENS-style identity, fake
  "Connect Wallet" hero. Our wallet integration is functional, never
  the page's identity.

## Strategic principles

1. **Numbers before rhetoric.** Show the measured tx hash before making
   any claim. The page should be auditable, not persuasive.
2. **One bold thing per surface.** The landing has the scrubbable chart.
   The pipeline section has the scroll-scrub. The console's Verify tab
   has the live event feed. Everything else stays quiet around it.
3. **Caveats are a feature.** Naming what we DON'T have builds more
   trust than another bullet of what we do.
4. **Mono carries identity.** Every count, fee, hash, address is
   JetBrains Mono. No exceptions.
5. **No scroll-jacking on body copy.** Animation lives on visualizations
   and on the one pinned pipeline section, never on text.
6. **Honest empty / offline states.** When the live feed can't reach
   stellar.expert, the UI says "live feed offline, showing committed
   measurements" and falls back to the known-good data from
   `bench/results.json`. Silently broken UI is worse than honest UI.
