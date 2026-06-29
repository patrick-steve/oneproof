// K=16 aggregator. Same circuit shape as aggregator/ (K=4) but verifies
// 16 inner UltraHonk proofs inside one outer proof. Single bumped-K
// approach instead of nested recursion (recursive-over-recursive in
// UltraHonk has KZG-accumulator subtleties that aren't worth the
// complexity for one extra measurement).
//
// Public inputs flat-layout: [root_0, nf_0, root_1, nf_1, ..., root_15, nf_15]
// Length = K * 2 = 32.
//
// Generated for benchmarking only. The on-chain verifier would need a
// separately-deployed instance with this circuit's VK; we project the
// on-chain fee from the K=4 baseline + Stellar's published fee formula
// (proof bytes + public inputs).

use bb_proof_verification::{UltraHonkProof, UltraHonkVerificationKey, verify_ultrahonk_proof};

global K: u32 = 16;

fn main(
    verification_key: UltraHonkVerificationKey,
    proofs: [UltraHonkProof; 16],
    public_inputs: pub [Field; 32],
    key_hash: Field,
) {
    for i in 0..K {
        let pis: [Field; 2] = [public_inputs[i * 2], public_inputs[i * 2 + 1]];
        verify_ultrahonk_proof(verification_key, proofs[i], pis, key_hash);
    }
}
