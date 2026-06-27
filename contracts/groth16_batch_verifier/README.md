# contracts/groth16_batch_verifier

> implement.md §3.2 — batch-verify M Groth16 proofs sharing one vk
> in a single Soroban tx via random linear combination + BN254 MSM.
> Pairings drop from 4M (naive) to M + 3.

## Surface

```rust
initialize(vk: VkBytes)                          // store the vk (one-shot)
vk() -> VkBytes                                  // read the stored vk
batch_verify(proofs, public_inputs) -> bool      // M proofs at once
```

`VkBytes` and `Groth16ProofBytes` carry G1/G2 in byte form
(BytesN<64> / BytesN<128>, big-endian per Soroban's serialization).
`PublicInputs = Vec<BytesN<32>>` — one 32-byte BE scalar per public
signal, in the same order the circuit declares them.

## Math (in one place)

For each proof j ∈ 0..M and challenge r_j derived via Keccak-256
Fiat–Shamir over (vk_hash, M, all (A_j, B_j, C_j, pub_j)):

```
R          = Σ_j r_j
vk_x_comb  = R · IC[0] + Σ_{i≥1} (Σ_j r_j · pub_{j,i-1}) · IC[i]    -- one MSM
C_comb     = Σ_j r_j · C_j                                          -- one MSM

pairing_check(
    [(r_j · A_j, B_j) for j in 0..M]
  + [(-R·α, β), (-vk_x_comb, γ), (-C_comb, δ)]
)
```

Soundness: rejection probability of any single forgery is bounded by
the field size after the random combination — standard Boneh-style
batch-verification argument.

## Why Keccak and not Poseidon

CAP-0075 exposes Poseidon as a permutation primitive only — the caller
has to supply MDS matrix + round constants (no standard preset). The
on-chain verifier never recomputes circuit-internal Poseidon hashes
(those live inside the SNARK), so Keccak-256 is sufficient for
Fiat–Shamir and avoids vendoring parameter tables. Matches the
UltraHonk verifier's own transcript choice in Tier 2.

## Negation trick

soroban-sdk 26.0.1 doesn't expose `g1_neg`. We compute `-P` as
`g1_mul(P, fr_sub(0, 1))` — i.e. `(r-1)·P = -P` in a group of order r.

## Fiat–Shamir reduction

Keccak gives 256 bits; BN254 r ≈ 2^253.6. We clear the top 3 bits
of the digest → value in [0, 2^253) < r, no panics, ~2× small-value
bias which is fine for FS use. Wide-reduction would be sounder for
production.

## Build

```
cd <repo root>
stellar contract build --manifest-path contracts/groth16_batch_verifier/Cargo.toml
```

Output: `target/wasm32v1-none/release/groth16_batch_verifier.wasm`.

## Test (host-side simulation)

```
cargo test --manifest-path contracts/groth16_batch_verifier/Cargo.toml
```

These tests are surface-shape only: `initialize` is one-shot, vk
round-trips, length/init checks panic correctly. The real "does it
verify real Groth16 proofs" check happens on testnet in Tier 1.3
(`bench/runBench.ts`), where we feed proofs produced by
`circuits/groth16_batch/build.sh`.
