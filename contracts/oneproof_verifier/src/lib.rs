// implement.md §4.3 – Soroban verifier for the outer UltraHonk proof.
// Adapted from vendor/rs-soroban-ultrahonk. On success, emits
// BatchVerified { n: N, aggregatedPublicInputs }. This is the one
// on-chain transaction whose cost we claim is flat in N.
// Implemented in Tier 2 step 4.3.

#![no_std]
