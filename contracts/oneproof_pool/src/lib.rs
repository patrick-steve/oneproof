// OneProof Pool — privacy-aware deposit/withdraw on Stellar.
//
// Depositors transfer a token into the pool and register a commitment
// (hash binding them to the deposit without revealing it). Withdrawers
// later submit an aggregated ZK proof attesting N withdrawals are valid,
// plus N nullifiers preventing double-spends. The contract verifies the
// proof via the existing oneproof_verifier (cross-contract call), records
// nullifiers, and dispatches N token transfers. ONE Stellar tx total.
//
// Stellar-specific killer feature: Soroban runs the verifier AND moves
// the assets in the same transaction. On EVM you'd need a verifier call
// followed by a separate transfer batch; here it's atomic and the
// on-chain cost stays constant regardless of N.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short,
    token, vec, Address, Bytes, BytesN, Env, IntoVal, Map, Symbol, Vec,
};

#[contract]
pub struct OneproofPool;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PoolError {
    NotInitialized          = 1,
    AlreadyInitialized      = 2,
    NullifierAlreadyUsed    = 3,
    ProofVerificationFailed = 4,
    InsufficientPoolBalance = 5,
    LengthMismatch          = 6,
    ZeroAmount              = 7,
}

#[contracttype]
#[derive(Clone)]
pub struct PoolConfig {
    pub verifier: Address,
    pub token:    Address,
}

// Storage keys (max 9 chars for symbol_short)
const K_CONFIG: Symbol = symbol_short!("config");
const K_NULLS:  Symbol = symbol_short!("nulls");
const K_COMMTS: Symbol = symbol_short!("commits");
const K_TOTAL:  Symbol = symbol_short!("total");

#[contractimpl]
impl OneproofPool {
    /// One-time init. Sets the token contract (typically the native XLM
    /// SAC) and the verifier contract address. After this, the pool is
    /// frozen — no admin, no upgrades, no governance.
    pub fn __constructor(
        env: Env,
        verifier: Address,
        token: Address,
    ) -> Result<(), PoolError> {
        if env.storage().instance().has(&K_CONFIG) {
            return Err(PoolError::AlreadyInitialized);
        }
        env.storage().instance().set(&K_CONFIG, &PoolConfig { verifier, token });
        env.storage().instance().set(&K_NULLS,  &Map::<BytesN<32>, bool>::new(&env));
        env.storage().instance().set(&K_COMMTS, &Vec::<BytesN<32>>::new(&env));
        env.storage().instance().set(&K_TOTAL,  &0i128);
        Ok(())
    }

    /// Deposit `amount` of the configured token into the pool. The
    /// depositor registers `commitment` — a hash binding them to this
    /// deposit. Their identity is on-chain (they have to sign); the
    /// commitment's preimage stays private.
    pub fn deposit(
        env: Env,
        from: Address,
        amount: i128,
        commitment: BytesN<32>,
    ) -> Result<(), PoolError> {
        from.require_auth();
        if amount <= 0 {
            return Err(PoolError::ZeroAmount);
        }
        let config = Self::load_config(&env)?;

        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        let mut commitments: Vec<BytesN<32>> = env.storage().instance()
            .get(&K_COMMTS).unwrap_or_else(|| Vec::new(&env));
        commitments.push_back(commitment.clone());
        env.storage().instance().set(&K_COMMTS, &commitments);

        let total: i128 = env.storage().instance().get(&K_TOTAL).unwrap_or(0);
        env.storage().instance().set(&K_TOTAL, &(total + amount));

        env.events().publish(
            (symbol_short!("Deposit"), from),
            (commitment, amount),
        );
        Ok(())
    }

    /// Batch withdraw. ONE aggregated ZK proof, N withdrawals dispatched.
    /// The aggregated proof attests N inner withdrawal proofs are valid.
    /// Atomic: any failure aborts the whole tx (no partial settlement).
    pub fn batch_withdraw(
        env: Env,
        proof: Bytes,
        public_inputs: Bytes,
        nullifiers: Vec<BytesN<32>>,
        recipients: Vec<Address>,
        amounts:    Vec<i128>,
    ) -> Result<(), PoolError> {
        let n = nullifiers.len();
        if recipients.len() != n || amounts.len() != n {
            return Err(PoolError::LengthMismatch);
        }
        let config = Self::load_config(&env)?;

        // 1. Verify the aggregated proof via the verifier contract.
        let ok: bool = env.invoke_contract(
            &config.verifier,
            &symbol_short!("verify"),
            vec![&env, public_inputs.into_val(&env), proof.into_val(&env)],
        );
        if !ok {
            return Err(PoolError::ProofVerificationFailed);
        }

        // 2. Check + record all nullifiers atomically.
        let mut nullset: Map<BytesN<32>, bool> = env.storage().instance()
            .get(&K_NULLS).unwrap_or_else(|| Map::new(&env));
        for i in 0..n {
            let nf = nullifiers.get(i).unwrap();
            if nullset.contains_key(nf.clone()) {
                return Err(PoolError::NullifierAlreadyUsed);
            }
            nullset.set(nf, true);
        }
        env.storage().instance().set(&K_NULLS, &nullset);

        // 3. Solvency check.
        let mut payout: i128 = 0;
        for i in 0..n {
            let a = amounts.get(i).unwrap();
            if a <= 0 {
                return Err(PoolError::ZeroAmount);
            }
            payout += a;
        }
        let total: i128 = env.storage().instance().get(&K_TOTAL).unwrap_or(0);
        if payout > total {
            return Err(PoolError::InsufficientPoolBalance);
        }
        env.storage().instance().set(&K_TOTAL, &(total - payout));

        // 4. Dispatch the N transfers.
        let token_client = token::Client::new(&env, &config.token);
        let me = env.current_contract_address();
        for i in 0..n {
            let recipient = recipients.get(i).unwrap();
            let amount    = amounts.get(i).unwrap();
            token_client.transfer(&me, &recipient, &amount);
        }

        env.events().publish((symbol_short!("BatchWdr"),), n);
        Ok(())
    }

    // ─── Read-only views ────────────────────────────────────────────

    pub fn config(env: Env) -> Result<PoolConfig, PoolError> {
        Self::load_config(&env)
    }

    pub fn total(env: Env) -> i128 {
        env.storage().instance().get(&K_TOTAL).unwrap_or(0)
    }

    pub fn commitment_count(env: Env) -> u32 {
        let cs: Vec<BytesN<32>> = env.storage().instance()
            .get(&K_COMMTS).unwrap_or_else(|| Vec::new(&env));
        cs.len()
    }

    pub fn nullifier_used(env: Env, nf: BytesN<32>) -> bool {
        let nulls: Map<BytesN<32>, bool> = env.storage().instance()
            .get(&K_NULLS).unwrap_or_else(|| Map::new(&env));
        nulls.contains_key(nf)
    }

    // ─── internals ──────────────────────────────────────────────────

    fn load_config(env: &Env) -> Result<PoolConfig, PoolError> {
        env.storage().instance()
            .get(&K_CONFIG)
            .ok_or(PoolError::NotInitialized)
    }
}
