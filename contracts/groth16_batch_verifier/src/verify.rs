// Batched Groth16 verification on BN254 via random linear combination + MSM.
// Implements the math from implement.md §3.2.
//
// Per-proof Groth16 equation (multi-pairing form):
//     e(A, B) · e(-α, β) · e(-vk_x, γ) · e(-C, δ) == 1
// where vk_x = IC[0] + Σ_i pub_i · IC[i].
//
// Batching with random r_j (bilinearity):
//     Π_j e(r_j·A_j, B_j) · e(-R·α, β) · e(-vk_x_comb, γ) · e(-C_comb, δ) == 1
// where R = Σ r_j ,
//       vk_x_comb = R · IC[0] + Σ_{i≥1} (Σ_j r_j · pub_{j,i-1}) · IC[i],
//       C_comb    = Σ_j r_j · C_j.
//
// Pairing count: M + 3 (vs 4M for naive M-separate verifies).
//
// Negation: soroban-sdk 26.0.1 does NOT expose g1_neg, so -P is computed
// as g1_mul(P, fr_sub(zero, one)) — the (r-1)·P trick.

use soroban_sdk::{
    crypto::bn254::{Bn254, Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    BytesN, Env, U256, Vec,
};

use crate::types::{Groth16ProofBytes, PublicInputs, VkBytes};

fn fr_zero(env: &Env) -> Bn254Fr {
    Bn254Fr::from_u256(U256::from_u32(env, 0))
}
fn fr_one(env: &Env) -> Bn254Fr {
    Bn254Fr::from_u256(U256::from_u32(env, 1))
}
fn fr_neg_one(env: &Env, bn: &Bn254) -> Bn254Fr {
    bn.fr_sub(&fr_zero(env), &fr_one(env))
}
fn fr_from_be(_env: &Env, b: &BytesN<32>) -> Bn254Fr {
    Bn254Fr::from_bytes(b.clone())
}

pub fn batch_verify(
    env: &Env,
    vk: &VkBytes,
    proofs: &Vec<Groth16ProofBytes>,
    public_inputs: &Vec<PublicInputs>,
    challenges: &Vec<Bn254Fr>,
) -> bool {
    let m = proofs.len();
    let n_ic = vk.ic.len();
    let n_pub = (n_ic - 1) as u32;

    if m == 0 || challenges.len() != m || public_inputs.len() != m {
        return false;
    }
    for j in 0..m {
        if public_inputs.get(j).unwrap().len() != n_pub {
            return false;
        }
    }

    let bn = env.crypto().bn254();
    let neg_one = fr_neg_one(env, &bn);

    // R = Σ r_j
    let mut r_sum = fr_zero(env);
    for j in 0..m {
        r_sum = bn.fr_add(&r_sum, &challenges.get(j).unwrap());
    }

    // IC MSM weights:
    //   w[0]   = R
    //   w[i]   = Σ_j r_j · pub_{j, i-1}     for i ∈ 1..n_ic
    let mut ic_weights = Vec::new(env);
    ic_weights.push_back(r_sum.clone());
    for i in 1..n_ic {
        let mut w_i = fr_zero(env);
        for j in 0..m {
            let r_j = challenges.get(j).unwrap();
            let pi_bytes = public_inputs.get(j).unwrap().get(i - 1).unwrap();
            let pub_ji = fr_from_be(env, &pi_bytes);
            w_i = bn.fr_add(&w_i, &bn.fr_mul(&r_j, &pub_ji));
        }
        ic_weights.push_back(w_i);
    }

    // vk_x_comb = MSM(IC, ic_weights)
    let mut ic_pts = Vec::new(env);
    for i in 0..n_ic {
        ic_pts.push_back(Bn254G1Affine::from_bytes(vk.ic.get(i).unwrap()));
    }
    let vk_x_comb = bn.g1_msm(ic_pts, ic_weights);

    // C_comb = MSM(C_j, r_j)
    let mut c_pts = Vec::new(env);
    for j in 0..m {
        c_pts.push_back(Bn254G1Affine::from_bytes(proofs.get(j).unwrap().c));
    }
    let c_comb = bn.g1_msm(c_pts, challenges.clone());

    // R·α
    let alpha = Bn254G1Affine::from_bytes(vk.alpha.clone());
    let r_alpha = bn.g1_mul(&alpha, &r_sum);

    // Negations (-r_alpha, -vk_x_comb, -c_comb)
    let neg_r_alpha = bn.g1_mul(&r_alpha, &neg_one);
    let neg_vk_x = bn.g1_mul(&vk_x_comb, &neg_one);
    let neg_c = bn.g1_mul(&c_comb, &neg_one);

    // Per-proof G1 = r_j · A_j (scalar mul), paired with raw B_j
    let mut g1_list = Vec::new(env);
    let mut g2_list = Vec::new(env);
    for j in 0..m {
        let p = proofs.get(j).unwrap();
        let a_j = Bn254G1Affine::from_bytes(p.a);
        let b_j = Bn254G2Affine::from_bytes(p.b);
        let r_j = challenges.get(j).unwrap();
        g1_list.push_back(bn.g1_mul(&a_j, &r_j));
        g2_list.push_back(b_j);
    }

    // Append the three "negative" pair terms
    let beta = Bn254G2Affine::from_bytes(vk.beta.clone());
    let gamma = Bn254G2Affine::from_bytes(vk.gamma.clone());
    let delta = Bn254G2Affine::from_bytes(vk.delta.clone());
    g1_list.push_back(neg_r_alpha);
    g2_list.push_back(beta);
    g1_list.push_back(neg_vk_x);
    g2_list.push_back(gamma);
    g1_list.push_back(neg_c);
    g2_list.push_back(delta);

    // Total pairings: M + 3
    bn.pairing_check(g1_list, g2_list)
}
