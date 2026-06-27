// Fiat–Shamir transcript for batch Groth16 verification.
//
// Per implement.md §3.2: absorb every (A_j, B_j, C_j, pub_j) BEFORE deriving
// any r_j — getting this ordering wrong breaks soundness. Then:
//     seed = Keccak256(vk_hash || M || A_0||B_0||C_0||pub_0 || ... )
//     r_j  = Keccak256(seed || j) → reduce to Bn254Fr
//
// Reduction: BN254 scalar modulus r ≈ 2.18·10^76, which is between 2^253 and
// 2^254. We clear the top 3 bits of the 256-bit Keccak digest, guaranteeing
// the value is in [0, 2^253) and so strictly < r without any modular reduction.
// Slight bias toward small values (max 2^253 / r ≈ 0.66), acceptable for
// Fiat–Shamir use. Wide-reduction would be ideal for production.

use soroban_sdk::{crypto::bn254::Bn254Fr, Bytes, BytesN, Env, Vec};

use crate::types::{Groth16ProofBytes, PublicInputs, VkBytes};

// Helpers — operate on Bytes directly so we don't depend on BytesN<N>
// conversions surviving the macro layer.
fn append_bytes_n_64(dst: &mut Bytes, src: &BytesN<64>) {
    dst.append(&src.clone().into());
}
fn append_bytes_n_128(dst: &mut Bytes, src: &BytesN<128>) {
    dst.append(&src.clone().into());
}
fn append_bytes_n_32(dst: &mut Bytes, src: &BytesN<32>) {
    dst.append(&src.clone().into());
}
fn append_bytes_n_4(dst: &mut Bytes, src: &BytesN<4>) {
    dst.append(&src.clone().into());
}

fn u32_be(env: &Env, x: u32) -> BytesN<4> {
    BytesN::from_array(env, &x.to_be_bytes())
}

/// Hash the vk into a single 32-byte commitment. Order matches the field
/// declaration order in VkBytes — alpha, beta, gamma, delta, then each ic
/// element in index order, preceded by ic.len() so a tampered ic length
/// can't collide with a shorter one.
fn vk_hash(env: &Env, vk: &VkBytes) -> BytesN<32> {
    let mut buf = Bytes::new(env);
    append_bytes_n_64(&mut buf, &vk.alpha);
    append_bytes_n_128(&mut buf, &vk.beta);
    append_bytes_n_128(&mut buf, &vk.gamma);
    append_bytes_n_128(&mut buf, &vk.delta);
    let n = vk.ic.len();
    append_bytes_n_4(&mut buf, &u32_be(env, n));
    for i in 0..n {
        append_bytes_n_64(&mut buf, &vk.ic.get(i).unwrap());
    }
    env.crypto().keccak256(&buf).to_bytes()
}

/// Derive M Fiat–Shamir challenges r_0..r_{M-1} bound to every input.
pub fn derive_challenges(
    env: &Env,
    vk: &VkBytes,
    proofs: &Vec<Groth16ProofBytes>,
    public_inputs: &Vec<PublicInputs>,
) -> Vec<Bn254Fr> {
    let m = proofs.len();
    let mut transcript = Bytes::new(env);

    // Bind to vk first (one fixed 32-byte commitment, not the full ~768 bytes)
    append_bytes_n_32(&mut transcript, &vk_hash(env, vk));
    // Bind to M
    append_bytes_n_4(&mut transcript, &u32_be(env, m));

    // Absorb every (A_j, B_j, C_j, pub_j) before any challenge is derived.
    for j in 0..m {
        let p = proofs.get(j).unwrap();
        append_bytes_n_64(&mut transcript, &p.a);
        append_bytes_n_128(&mut transcript, &p.b);
        append_bytes_n_64(&mut transcript, &p.c);
        let pi = public_inputs.get(j).unwrap();
        let n_pub = pi.len();
        append_bytes_n_4(&mut transcript, &u32_be(env, n_pub));
        for i in 0..n_pub {
            append_bytes_n_32(&mut transcript, &pi.get(i).unwrap());
        }
    }

    let seed = env.crypto().keccak256(&transcript).to_bytes();

    // r_j = Keccak256(seed || j) with top 3 bits cleared → strictly < r
    let mut out = Vec::new(env);
    for j in 0..m {
        let mut hin = Bytes::new(env);
        append_bytes_n_32(&mut hin, &seed);
        append_bytes_n_4(&mut hin, &u32_be(env, j));
        let mut h = env.crypto().keccak256(&hin).to_bytes().to_array();
        h[0] &= 0x1f; // clear top 3 bits → value < 2^253 < r
        out.push_back(Bn254Fr::from_bytes(BytesN::from_array(env, &h)));
    }
    out
}
