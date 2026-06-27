// bb_proof_verification at tag v0.87.0 exports `verify_ultrahonk_proof`,
// not `verify_honk_proof_non_zk` (that rename + zk/no-zk split came later).
use bb_proof_verification::{UltraHonkProof, UltraHonkVerificationKey, verify_ultrahonk_proof};

fn main(
    verification_key: UltraHonkVerificationKey,
    proof: UltraHonkProof,
    public_inputs: pub [Field; 1],
    key_hash: Field,
) {
    verify_ultrahonk_proof(verification_key, proof, public_inputs, key_hash);
}
