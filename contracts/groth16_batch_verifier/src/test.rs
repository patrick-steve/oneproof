// Lightweight compile-time + sanity tests for the batch verifier shape.
//
// The real "do real proofs verify on-chain?" test happens in Tier 1.3
// (bench/runBench.ts on testnet), where we feed proofs produced by
// circuits/groth16_batch/build.sh through this contract. Here we only
// exercise the contract surface so build breakage shows up fast.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Vec};

use crate::{
    types::{Groth16ProofBytes, PublicInputs, VkBytes},
    Groth16BatchVerifier, Groth16BatchVerifierClient,
};

fn zero_g1(env: &Env) -> BytesN<64> {
    BytesN::from_array(env, &[0u8; 64])
}
fn zero_g2(env: &Env) -> BytesN<128> {
    BytesN::from_array(env, &[0u8; 128])
}
fn zero_fr(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn placeholder_vk(env: &Env, n_pub: usize) -> VkBytes {
    let mut ic = Vec::new(env);
    for _ in 0..(n_pub + 1) {
        ic.push_back(zero_g1(env));
    }
    VkBytes {
        alpha: zero_g1(env),
        beta: zero_g2(env),
        gamma: zero_g2(env),
        delta: zero_g2(env),
        ic,
    }
}

fn placeholder_proof(env: &Env) -> Groth16ProofBytes {
    Groth16ProofBytes {
        a: zero_g1(env),
        b: zero_g2(env),
        c: zero_g1(env),
    }
}

fn placeholder_inputs(env: &Env, n_pub: usize) -> PublicInputs {
    let mut pi = Vec::new(env);
    for _ in 0..n_pub {
        pi.push_back(zero_fr(env));
    }
    pi
}

// initialize stores the vk; second call must panic with AlreadyInitialized.
#[test]
#[should_panic]
fn double_initialize_panics() {
    let env = Env::default();
    let id = env.register(Groth16BatchVerifier, ());
    let client = Groth16BatchVerifierClient::new(&env, &id);
    let vk = placeholder_vk(&env, 2);
    client.initialize(&vk);
    client.initialize(&vk);
}

// batch_verify before initialize must panic NotInitialized.
#[test]
#[should_panic]
fn batch_before_init_panics() {
    let env = Env::default();
    let id = env.register(Groth16BatchVerifier, ());
    let client = Groth16BatchVerifierClient::new(&env, &id);
    let mut proofs = Vec::new(&env);
    proofs.push_back(placeholder_proof(&env));
    let mut pis = Vec::new(&env);
    pis.push_back(placeholder_inputs(&env, 2));
    let _ = client.batch_verify(&proofs, &pis);
}

// Length-mismatch (M proofs but M-1 public-input arrays) must panic.
#[test]
#[should_panic]
fn length_mismatch_panics() {
    let env = Env::default();
    let id = env.register(Groth16BatchVerifier, ());
    let client = Groth16BatchVerifierClient::new(&env, &id);
    client.initialize(&placeholder_vk(&env, 2));

    let mut proofs = Vec::new(&env);
    proofs.push_back(placeholder_proof(&env));
    proofs.push_back(placeholder_proof(&env));
    let pis = Vec::<PublicInputs>::new(&env); // length 0, proofs length 2
    let _ = client.batch_verify(&proofs, &pis);
}

// Stored vk round-trips.
#[test]
fn vk_round_trips() {
    let env = Env::default();
    let id = env.register(Groth16BatchVerifier, ());
    let client = Groth16BatchVerifierClient::new(&env, &id);
    let vk = placeholder_vk(&env, 3);
    client.initialize(&vk);
    let read_back = client.vk();
    assert_eq!(read_back.ic.len(), 4);
}

// Author-suppress unused warnings.
#[allow(dead_code)]
fn _addr(env: &Env) -> Address {
    Address::generate(env)
}
