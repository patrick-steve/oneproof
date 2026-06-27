// implement.md §3.1 — inner Circom circuit for the Tier 1 batch track.
//
// Statement (private transfer leaf):
//   c   = Poseidon(secret, amount, blinding)       // commitment
//   c   ∈ Merkle tree of depth D=16 with root R    // membership
//   nf  = Poseidon(secret, leafIndex)              // nullifier
//
// Public  : root, nullifier
// Private : secret, amount, blinding, pathElements[D], pathIndices[D]
//
// Same statement as the Noir inner circuit in §4.1 — the two tracks prove
// the same thing in two proof systems so the benchmark compares like with
// like (naive Groth16 vs batched Groth16 vs recursive UltraHonk).

pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

// 2-input mux: swap (in[0], in[1]) when s = 1, leave as-is when s = 0.
// Also enforces s ∈ {0,1}.
template DualMux() {
    signal input  in[2];
    signal input  s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Poseidon-based Merkle inclusion proof for a tree of fixed depth D.
// pathIndices[i] = 0 → current is left child; = 1 → current is right child.
template MerkleTreeChecker(D) {
    signal input leaf;
    signal input root;
    signal input pathElements[D];
    signal input pathIndices[D];

    component selectors[D];
    component hashers[D];

    signal currentHash[D + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < D; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== currentHash[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s     <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].out[0];
        hashers[i].inputs[1] <== selectors[i].out[1];

        currentHash[i + 1] <== hashers[i].out;
    }

    root === currentHash[D];
}

template OneProofInner(D) {
    // Public inputs (order matters: matches snarkjs export ordering and IC indexing)
    signal input  root;
    signal input  nullifier;

    // Private inputs
    signal input  secret;
    signal input  amount;
    signal input  blinding;
    signal input  pathElements[D];
    signal input  pathIndices[D];

    // commitment c = Poseidon(secret, amount, blinding)
    component cHash = Poseidon(3);
    cHash.inputs[0] <== secret;
    cHash.inputs[1] <== amount;
    cHash.inputs[2] <== blinding;
    signal c;
    c <== cHash.out;

    // Merkle membership: c lives at position `pathIndices` under `root`
    component mtc = MerkleTreeChecker(D);
    mtc.leaf <== c;
    mtc.root <== root;
    for (var i = 0; i < D; i++) {
        mtc.pathElements[i] <== pathElements[i];
        mtc.pathIndices[i]  <== pathIndices[i];
    }

    // leafIndex = Σ pathIndices[i] · 2^i (Bits2Num re-constrains bit-ness, harmless)
    component leafIndexer = Bits2Num(D);
    for (var i = 0; i < D; i++) {
        leafIndexer.in[i] <== pathIndices[i];
    }
    signal leafIndex;
    leafIndex <== leafIndexer.out;

    // nullifier = Poseidon(secret, leafIndex)
    component nfHash = Poseidon(2);
    nfHash.inputs[0] <== secret;
    nfHash.inputs[1] <== leafIndex;
    nullifier === nfHash.out;
}

// D = 16 → 2^16 = 65,536 anonymity-set slots. Pinned per implement.md §3.1.
component main {public [root, nullifier]} = OneProofInner(16);
