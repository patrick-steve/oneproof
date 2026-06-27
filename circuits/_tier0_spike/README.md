# Tier 0 spike — Noir off-chain recursion

> GREEN on 2026-06-27. Recursion works on the pinned stack
> (nargo 1.0.0-beta.9 + bb 0.87.0 + bb_proof_verification @ v0.87.0).

Purpose: prove that recursion is reachable on our exact pinned toolchain
before any product code is written. `bb verify` on the outer proof returning
success unlocks Tier 2.

## Run
```
./build.sh
```
Green = final line `=== SPIKE 2.1 GREEN: recursive proof verified off-chain ===`.

## Layout
```
inner/        trivial circuit: res = x*2 + y; assert(res == 9)
aggregator/   verifies one inner UltraHonk proof via verify_ultrahonk_proof
build.sh      bb CLI pipeline, no node_modules
```

## What this taught us (write these into §4 once Tier 2 starts)

1. **bb.js 0.87.0 cannot do recursive proving.** Its WASM is missing the
   recursive-prover entrypoints — `recursiveBackend.generateProof()` dies
   with `RuntimeError: null function or function signature mismatch` deep
   in WASM. The JS recursion path landed in a later release. Use the bb
   CLI, not @aztec/bb.js, for recursion at 0.87.0.

2. **Inner proof MUST be produced with `--honk_recursion 1
   --init_kzg_accumulator --oracle_hash poseidon2`.** Per `bb prove --help`:
   *"Poseidon2 is to be used for proofs that are intended to be verified
   inside of a circuit."* `--honk_recursion 1` adds a pairing-point
   accumulator to the proof structure; the recursive verifier picks it up
   transparently — your aggregator's `public_inputs` array stays the size
   of the inner's declared public inputs (1 element here), not larger.

3. **Outer proof uses `--oracle_hash keccak`.** Matches what
   rs-soroban-ultrahonk's on-chain verifier expects (its transcript.rs
   header literally says "Keccak-256 based transcript used by the native
   Barretenberg UltraFlavor verifier"). This is the proof that goes to
   Soroban in spike 2.2 / Tier 2.

4. **`bb_proof_verification` at tag v0.87.0 exports `verify_ultrahonk_proof`,
   NOT `verify_honk_proof_non_zk`.** The latter is the newer name; using it
   gives `cannot find verify_honk_proof_non_zk in this scope` at compile.

5. **At bb.js 0.87.0, `generateRecursiveProofArtifacts` returns vkAsFields
   populated but proofAsFields=[] and vkHash="".** If we ever revisit JS,
   slice the proof bytes manually (32 bytes → 1 Field) and compute vkHash
   via Poseidon ourselves.

6. **`key_hash` is a binding-only public input.** `verify_ultrahonk_proof`
   does not enforce a relationship between key_hash and the actual vk. For
   off-chain proofs, `"0x00"` works. For on-chain Tier 2 we should compute
   a real hash so the contract can bind to a known VK.

7. **`UltraHonkProof = [Field; 456]` and `UltraHonkVerificationKey = [Field; 112]`
   at v0.87.0.** Constants `RECURSIVE_PROOF_LENGTH` and
   `HONK_VERIFICATION_KEY_LENGTH_IN_FIELDS` in lib.nr — confirm by running
   `jq length` on the inner's `*_fields.json` after a build.
