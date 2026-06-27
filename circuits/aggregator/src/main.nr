// implement.md section 4.2 - K-to-1 aggregator over inner_transfer proofs.
//
// Verifies K=4 inner UltraHonk proofs via verify_ultrahonk_proof (the
// v0.87.0 API name; later versions renamed it to verify_honk_proof_non_zk).
// The aggregator's public inputs are the flattened (root, nullifier) pairs
// from the K inner proofs, so the on-chain verifier learns what was
// aggregated, not just that something was.
//
// K=4 pinned base case; tree composition (depth log_K(N) for larger N)
// happens in the JS orchestrator (prover/src/aggregate.ts).

use bb_proof_verification::{UltraHonkProof, UltraHonkVerificationKey, verify_ultrahonk_proof};

global K: u32 = 4;

fn main(
    verification_key: UltraHonkVerificationKey,
    proofs: [UltraHonkProof; 4],
    // Flattened public inputs: [root_0, nf_0, root_1, nf_1, ..., root_{K-1}, nf_{K-1}].
    // Length = K * 2 = 8.
    public_inputs: pub [Field; 8],
    key_hash: Field,
) {
    for i in 0..K {
        let pis: [Field; 2] = [public_inputs[i * 2], public_inputs[i * 2 + 1]];
        verify_ultrahonk_proof(verification_key, proofs[i], pis, key_hash);
    }
}
