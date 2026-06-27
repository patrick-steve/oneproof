// Storage-friendly byte representations for the verifying key and Groth16
// proofs. Soroban's typed crypto primitives (Bn254G1Affine etc.) convert
// cleanly to/from these via from_bytes/to_bytes; we use the byte form on
// the wire and in storage, the typed form only at the math layer.
//
// Sizes inlined as literals (64 / 128) in the struct fields because the
// #[contracttype] derive macro can't see through named-const generics —
// using `BytesN<G1_BYTES>` confuses the macro and the TryFromVal impls
// never get emitted. We keep the constants as documentation only.

use soroban_sdk::{contracttype, BytesN, Vec};

// G1 point: 64 bytes = be(x) || be(y). Per soroban_sdk docs.
#[allow(dead_code)] // documentation-only; struct fields use the literal
pub const G1_BYTES: u32 = 64;
// G2 point: 128 bytes per the Bn254G2Affine::from_bytes signature.
#[allow(dead_code)]
pub const G2_BYTES: u32 = 128;

#[contracttype]
#[derive(Clone, Debug)]
pub struct VkBytes {
    pub alpha: BytesN<64>,
    pub beta: BytesN<128>,
    pub gamma: BytesN<128>,
    pub delta: BytesN<128>,
    // ic[0] is the constant term; ic[1..] index public inputs in order.
    // Length must equal nPublic + 1 (snarkjs convention).
    pub ic: Vec<BytesN<64>>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Groth16ProofBytes {
    pub a: BytesN<64>,  // G1
    pub b: BytesN<128>, // G2
    pub c: BytesN<64>,  // G1
}

// Public inputs for one proof: an array of 32-byte BE scalars (Bn254Fr-shaped).
// The full batch input is Vec<PublicInputs> where outer.len() == proofs.len().
pub type PublicInputs = Vec<BytesN<32>>;
