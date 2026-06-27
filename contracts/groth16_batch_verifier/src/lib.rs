// OneProof Tier 1 batch-Groth16 verifier on Soroban (BN254 + MSM).
//
// Verifies M Groth16 proofs sharing one vk in a single tx via random linear
// combination, collapsing 4M pairings into M + 3. See implement.md §3.2.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, panic_with_error, symbol_short, BytesN, Env, Vec};

mod transcript;
mod types;
mod verify;

#[cfg(test)]
mod test;

use types::{Groth16ProofBytes, VkBytes};

// PublicInputs is a `type` alias internally for readability, but Soroban's
// contract-spec generator doesn't expand type aliases — they show up as
// "Missing Entry" at invoke time. So public function signatures use the
// concrete `Vec<BytesN<32>>` directly.

#[contracttype]
#[derive(Clone, Copy)]
pub enum DataKey {
    Vk,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    EmptyBatch = 3,
    LengthMismatch = 4,
    BadPublicInputCount = 5,
    VerifyFailed = 6,
}

#[contract]
pub struct Groth16BatchVerifier;

#[contractimpl]
impl Groth16BatchVerifier {
    /// Store the verifying key. One-shot — re-init reverts.
    pub fn initialize(env: Env, vk: VkBytes) {
        let storage = env.storage().instance();
        if storage.has(&DataKey::Vk) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        storage.set(&DataKey::Vk, &vk);
    }

    /// Read the stored vk (handy for clients building transcripts off-chain).
    pub fn vk(env: Env) -> VkBytes {
        env.storage()
            .instance()
            .get(&DataKey::Vk)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    /// Verify ONE proof against the stored vk. This is the "naive baseline"
    /// endpoint — running it N times costs N pairing checks (= 4N pairings
    /// plus N tx-level overheads). Same contract as batch_verify so the
    /// comparison isn't muddied by deploy-time differences.
    ///
    /// Implemented as batch_verify with M=1 (math reduces to the standard
    /// Groth16 check; the +3 extra pairings are the αβ/γ/δ vk terms that
    /// any single-proof verifier needs anyway).
    pub fn verify_one(
        env: Env,
        proof: Groth16ProofBytes,
        public_inputs: Vec<BytesN<32>>,
    ) -> bool {
        let mut proofs = Vec::new(&env);
        proofs.push_back(proof);
        let mut all_inputs = Vec::new(&env);
        all_inputs.push_back(public_inputs);
        Self::batch_verify(env, proofs, all_inputs)
    }

    /// Batch-verify M proofs against the stored vk. Returns true iff the
    /// combined pairing check passes. Emits a `BatchVerified(count)` event
    /// on success. Caller is responsible for passing root/nullifier
    /// public inputs in canonical order (matches IC[1..]).
    pub fn batch_verify(
        env: Env,
        proofs: Vec<Groth16ProofBytes>,
        public_inputs: Vec<Vec<BytesN<32>>>,
    ) -> bool {
        let vk: VkBytes = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));

        let m = proofs.len();
        if m == 0 {
            panic_with_error!(&env, Error::EmptyBatch);
        }
        if public_inputs.len() != m {
            panic_with_error!(&env, Error::LengthMismatch);
        }
        let n_pub = (vk.ic.len() - 1) as u32;
        for j in 0..m {
            if public_inputs.get(j).unwrap().len() != n_pub {
                panic_with_error!(&env, Error::BadPublicInputCount);
            }
        }

        let challenges = transcript::derive_challenges(&env, &vk, &proofs, &public_inputs);
        let ok = verify::batch_verify(&env, &vk, &proofs, &public_inputs, &challenges);

        if ok {
            env.events().publish(
                (symbol_short!("BatchOk"),),
                m as u32,
            );
        }
        ok
    }
}
