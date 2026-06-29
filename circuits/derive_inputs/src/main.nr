// Helper circuit -- given the user's (secret, amount, blinding), compute
// every public value the real inner_transfer proof will need:
//   commitment c   = pedersen_hash(secret, amount, blinding)
//   merkle root    = membership root for a single-leaf tree at index 0
//   nullifier nf   = pedersen_hash(secret, leaf_index=0)
//   path_elements  = the 16 empty-tree siblings Z[0..D-1]
//
// Emits all of them via println so `nargo execute` from the backend can
// parse stdout and write a real Prover.toml for the inner_transfer prover.
//
// Why a separate circuit instead of computing in JS: pedersen_hash uses
// BN254 generator points that we'd have to re-implement (~hundreds of
// lines of unsafe BN math). A 50-line Noir circuit + nargo execute (~2s)
// is dramatically cheaper to write and maintain. The values produced
// are bit-for-bit identical to what the inner_transfer circuit computes
// internally, by definition -- same hash function, same library.
//
// No asserts on purpose: this is a pure computation helper. The real
// inner_transfer circuit re-runs all this AND asserts everything holds.

use std::hash::pedersen_hash;

global D: u32 = 16;

fn main(
    secret:   pub Field,
    amount:   pub Field,
    blinding: pub Field,
) {
    // commitment
    let c: Field = pedersen_hash([secret, amount, blinding]);

    // Empty-tree merkle siblings Z[d]: Z[0] = 0, Z[d] = H(Z[d-1], Z[d-1]).
    // For our single-leaf-at-index-0 tree, the user's commitment sits at
    // leaf 0; every sibling on the path up to the root is the precomputed
    // Z[d] for that level. Root = current after walking up D levels.
    let mut z: Field = 0;
    let mut current = c;
    let mut path_elements: [Field; 16] = [0; 16];
    for i in 0..D {
        path_elements[i] = z;
        current = pedersen_hash([current, z]); // path_indices[i] = 0
        z       = pedersen_hash([z, z]);
    }
    let root = current;

    // nullifier (leaf index is 0 for the single-user-at-leaf-0 case)
    let leaf_index: Field = 0;
    let nullifier = pedersen_hash([secret, leaf_index]);

    // Emit via println -- backend reads stdout from `nargo execute` and
    // parses these marked lines. The OP_DERIVED_{START,END} markers let
    // us skip any other noise nargo prints during execution.
    println("OP_DERIVED_START");
    println("commitment");
    println(c);
    println("root");
    println(root);
    println("nullifier");
    println(nullifier);
    println("path_elements_start");
    for i in 0..D {
        println(path_elements[i]);
    }
    println("OP_DERIVED_END");
}
