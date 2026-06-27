// implement.md §3.1 – inner Circom circuit for the batch track.
// Statement: Poseidon commitment + Merkle membership (depth D=16) + nullifier.
// Public: root, nullifier. Private: secret, amount, blinding, path.
// Implemented in Tier 1 step 3.1. circom version pinned in §0.1.

pragma circom 2.1.0;

// template Inner() { ... }
// component main = Inner();
