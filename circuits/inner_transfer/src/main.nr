// implement.md section 4.1 - inner private-transfer circuit (UltraHonk leaf).
//
// Same shape as the Circom batch-track inner circuit so the recursive and
// batch bench lines are comparing like-for-like (commitment + Merkle
// membership + nullifier). The hash function differs across tracks
// because Noir's beta.9 stdlib exposes only the Poseidon2 permutation,
// not a user-facing Poseidon hash. We use pedersen_hash here. That's
// fine - the on-chain verifier never recomputes any in-circuit hash
// (the verifier just checks pairings), so per-track hash choice has
// no on-chain consequence. Each track is self-consistent.

use std::hash::pedersen_hash;

global D: u32 = 16;

// root + nullifier are public inputs; the rest are private witness.
fn main(
    root: pub Field,
    nullifier: pub Field,
    secret: Field,
    amount: Field,
    blinding: Field,
    path_elements: [Field; 16],
    path_indices: [Field; 16],
) {
    // commitment c = H(secret, amount, blinding)
    let c: Field = pedersen_hash([secret, amount, blinding]);

    // Merkle membership of c under `root` at position `path_indices`.
    // path_indices[i] = 0  -> current is left child;  = 1 -> right child.
    let mut current = c;
    for i in 0..D {
        let s = path_indices[i];
        // bit constraint on s
        assert(s * (1 - s) == 0);
        // mux to (left, right) based on s
        let left = (path_elements[i] - current) * s + current;
        let right = (current - path_elements[i]) * s + path_elements[i];
        current = pedersen_hash([left, right]);
    }
    assert(root == current);

    // leaf_index = sum of path_indices[i] * 2^i
    let mut leaf_index: Field = 0;
    let mut coef: Field = 1;
    for i in 0..D {
        leaf_index = leaf_index + path_indices[i] * coef;
        coef = coef * 2;
    }

    // nullifier = H(secret, leaf_index)
    let computed_nf: Field = pedersen_hash([secret, leaf_index]);
    assert(nullifier == computed_nf);
}

// Compute the public inputs (root, nullifier) and 16 path_elements for the
// demo private witness, by running this circuit in unconstrained execution.
// Output is parsed by build.sh to write Prover.toml.
#[test]
fn print_inputs_for_demo() {
    let secret: Field = 7;
    let amount: Field = 1000;
    let blinding: Field = 42;

    let c = pedersen_hash([secret, amount, blinding]);

    // Empty-tree siblings Z[d] (standard zkSNARK privacy-pool convention):
    //   Z[0] = 0
    //   Z[d] = H(Z[d-1], Z[d-1])
    let mut z: Field = 0;
    let mut current = c;
    let mut path_elements: [Field; 16] = [0; 16];
    for i in 0..D {
        path_elements[i] = z;
        current = pedersen_hash([current, z]); // pathIndices[i]=0, sibling=z
        z = pedersen_hash([z, z]);
    }
    let root = current;

    let leaf_index: Field = 0;
    let nullifier = pedersen_hash([secret, leaf_index]);

    println("INPUTS_FOR_DEMO_START");
    println("root");
    println(root);
    println("nullifier");
    println(nullifier);
    println("path_elements_start");
    for i in 0..D {
        println(path_elements[i]);
    }
    println("INPUTS_FOR_DEMO_END");

    // Sanity: assert main(...) succeeds with these inputs (no panic)
    main(root, nullifier, secret, amount, blinding, path_elements, [0; 16]);
}
