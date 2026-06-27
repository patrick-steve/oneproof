// implement.md §3.2 – batch-verify M Groth16 proofs sharing one vk via
// random linear combination + BN254 MSM (Protocol 26 host fn).
// Emits BatchVerified { count: M, root, nullifiers }.
// Implemented in Tier 1 step 3.2.

#![no_std]
