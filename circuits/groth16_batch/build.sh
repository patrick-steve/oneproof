#!/usr/bin/env bash
# Tier 1.1 (§3.1) — build the Circom inner circuit + Groth16 setup.
#
# Idempotent: re-running skips already-done work. Produces:
#   target/circuit.r1cs           — R1CS for the prover
#   target/circuit_js/            — witness-generator wasm + helper
#   target/circuit_final.zkey     — circuit-specific proving key
#   target/vkey.json              — verifying key (committed in repo)
#   target/proof.json             — sanity-check Groth16 proof
#   target/public.json            — sanity-check public signals
#   target/ptau/...               — cached Hermez Powers of Tau (~11 MB)
#
# Green: `snarkjs groth16 verify` on the sanity proof returns OK.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# nvm-managed node 22, cargo-installed circom on PATH
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true
export PATH="$HOME/.cargo/bin:$PATH"

mkdir -p target/ptau

echo "=== nvm node $(node --version) / circom $(circom --version) / snarkjs ==="

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [1/6] npm install (circomlib + circomlibjs) ==="
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund --loglevel=warn
fi

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [2/6] circom compile (R1CS + witness wasm) ==="
circom circuit.circom \
  --r1cs --wasm --sym \
  -o target \
  -l node_modules
# circom emits CommonJS generate_witness.js but our package.json declares
# "type": "module" (for tsx/ESM in generate-input.ts), so node refuses to
# load the witness generator as ESM. Drop a scoped CJS override.
echo '{"type":"commonjs"}' > target/circuit_js/package.json
echo "    constraint count: $(snarkjs r1cs info target/circuit.r1cs 2>/dev/null | grep -i 'constraints' | head -1)"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [3/6] fetch Hermez ptau (cache in target/ptau) ==="
PTAU_FILE="powersOfTau28_hez_final_15.ptau"
PTAU_PATH="target/ptau/$PTAU_FILE"
# The original Hermez S3 bucket returns 403 since ~2025; the canonical mirror
# is now Google Cloud Storage at storage.googleapis.com/zkevm/ptau/...
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/$PTAU_FILE"
if [ ! -f "$PTAU_PATH" ]; then
  echo "    downloading $PTAU_FILE (~36 MB) — multi-party ceremony output, trusted"
  curl -L --fail -o "$PTAU_PATH" "$PTAU_URL"
fi
echo "    using $PTAU_PATH ($(du -h "$PTAU_PATH" | cut -f1))"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [4/6] groth16 setup (circuit-specific zkey + vkey.json) ==="
if [ ! -f target/circuit_final.zkey ]; then
  snarkjs groth16 setup target/circuit.r1cs "$PTAU_PATH" target/circuit_0000.zkey
  # Single-participant ceremony for the DEMO — production would do a
  # multi-party contribution round here. Documented in README as a caveat.
  snarkjs zkey contribute target/circuit_0000.zkey target/circuit_final.zkey \
    --name="oneproof-demo" -v -e="oneproof demo contribution 2026-06-27"
  rm -f target/circuit_0000.zkey
fi
# Write vkey outside target/ so the repo .gitignore (**/target/) doesn't hide it.
# vkey.json is a small (~3 KB) deliverable that the on-chain verifier embeds —
# committing it is the whole point.
snarkjs zkey export verificationkey target/circuit_final.zkey vkey.json
echo "    vkey published at circuits/groth16_batch/vkey.json (committed to repo)"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [5/6] generate deterministic sanity input ==="
npx tsx generate-input.ts

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [6/6] sanity prove + verify (off-chain) ==="
node target/circuit_js/generate_witness.js \
  target/circuit_js/circuit.wasm \
  input.json \
  target/witness.wtns
snarkjs groth16 prove \
  target/circuit_final.zkey \
  target/witness.wtns \
  target/proof.json \
  target/public.json
snarkjs groth16 verify \
  target/vkey.json \
  target/public.json \
  target/proof.json

echo
echo "=== TIER 1.1 GREEN: Circom inner circuit proves + verifies off-chain ==="
