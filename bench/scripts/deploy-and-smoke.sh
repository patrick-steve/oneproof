#!/usr/bin/env bash
# Tier 1.3 — deploy groth16_batch_verifier to testnet, init with the Tier 1.1
# vkey, smoke-test verify_one with the committed sanity proof.
#
# Green iff the verify_one tx returns "true".
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO"

# nvm node 22, cargo, stellar on PATH
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

NETWORK="testnet"
SOURCE="alice"
WASM="$REPO/contracts/groth16_batch_verifier/target/wasm32v1-none/release/groth16_batch_verifier.wasm"
OUT="$REPO/bench/out"
mkdir -p "$OUT"

echo "=== stellar $(stellar --version | head -1) / node $(node --version) ==="

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [1/5] ensure alice exists + funded on testnet ==="
stellar network add "$NETWORK" \
  --rpc-url "https://soroban-testnet.stellar.org" \
  --network-passphrase "Test SDF Network ; September 2015" 2>/dev/null || true
stellar keys generate "$SOURCE" 2>/dev/null || true
stellar keys fund "$SOURCE" --network "$NETWORK" 2>&1 | tail -3 || true
echo "    alice = $(stellar keys address $SOURCE)"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [2/5] build contract wasm (cached if no change) ==="
stellar contract build --manifest-path contracts/groth16_batch_verifier/Cargo.toml
ls -la "$WASM"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [3/5] convert snarkjs artifacts → soroban byte JSON ==="
( cd bench && [ -d node_modules ] || npm install --no-audit --no-fund --loglevel=warn )
npx --prefix bench tsx bench/src/snarkjs-to-soroban.ts vk \
  "$REPO/circuits/groth16_batch/vkey.json" "$OUT/vk.cli.json"
npx --prefix bench tsx bench/src/snarkjs-to-soroban.ts proof \
  "$REPO/circuits/groth16_batch/target/proof.json" \
  "$REPO/circuits/groth16_batch/target/public.json" "$OUT"
echo "    converted artifacts:"
ls -la "$OUT"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [4/5] deploy + initialize ==="
# Capture deploy output to a file so we can parse the contract ID cleanly.
# stellar-cli writes diagnostics (✅ Deployed, tx links) to stderr and the
# contract ID to stdout — but only when stdout is captured; in a terminal
# both are interleaved.
DEPLOY_LOG="$OUT/deploy.log"
stellar contract deploy \
  --wasm "$WASM" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  > "$OUT/contract_id.raw" 2> "$DEPLOY_LOG"
echo "    --- stellar contract deploy stderr ---"
cat "$DEPLOY_LOG" | sed 's/^/    /'
echo "    --- stellar contract deploy stdout ---"
cat "$OUT/contract_id.raw" | sed 's/^/    /'
# The contract ID is the only line on stdout, but be defensive: take the last
# non-empty line that matches the strkey C... pattern.
CONTRACT_ID="$(grep -oE 'C[A-Z0-9]{55,}' "$OUT/contract_id.raw" | tail -1)"
if [ -z "$CONTRACT_ID" ]; then
  echo "ERROR: could not extract contract ID from deploy output"
  exit 1
fi
echo "    CONTRACT_ID = $CONTRACT_ID"
echo "$CONTRACT_ID" > "$OUT/contract_id"

# Testnet RPC propagation lag — `stellar contract deploy` returns once the
# tx is included on the RPC it talks to, but subsequent invokes can land on
# a node that hasn't synced yet. Poll until the contract is reachable.
echo "    waiting for contract to be reachable via RPC..."
for i in $(seq 1 30); do
  if stellar contract invoke --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" --send=no -- vk >/dev/null 2>&1; then
    # `vk()` will panic NotInitialized but that means the contract IS visible
    echo "    contract reachable after ${i}s"
    break
  fi
  out="$(stellar contract invoke --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" --send=no -- vk 2>&1 || true)"
  if echo "$out" | grep -q "NotInitialized\|Error(Contract, #2)"; then
    echo "    contract reachable after ${i}s (NotInitialized as expected)"
    break
  fi
  if [ "$i" = 30 ]; then
    echo "    TIMEOUT waiting for contract; last RPC response was:"
    echo "$out" | head -5 | sed 's/^/      /'
    exit 1
  fi
  sleep 1
done

invoke_with_retry() {
  local n=3
  for attempt in $(seq 1 $n); do
    if "$@"; then
      return 0
    fi
    if [ "$attempt" -lt "$n" ]; then
      echo "    invoke attempt $attempt failed; retrying in 5s..."
      sleep 5
    fi
  done
  return 1
}

invoke_with_retry stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- initialize \
  --vk "$(cat "$OUT/vk.cli.json")"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [5/5] smoke verify_one with the Tier 1.1 sanity proof ==="
RESULT=""
for attempt in 1 2 3; do
  if RESULT="$(stellar contract invoke \
      --id "$CONTRACT_ID" \
      --source "$SOURCE" \
      --network "$NETWORK" \
      -- verify_one \
      --proof "$(cat "$OUT/proof.cli.json")" \
      --public_inputs "$(cat "$OUT/public_inputs.cli.json")" 2>"$OUT/verify_one.log")"; then
    break
  fi
  echo "    verify_one attempt $attempt failed; stellar-cli stderr:"
  cat "$OUT/verify_one.log" | tail -5 | sed 's/^/      /'
  if [ "$attempt" -lt 3 ]; then
    sleep 5
  fi
done
echo "    verify_one returned: $RESULT"

if [ "$RESULT" = "true" ]; then
  echo
  echo "=== TIER 1.3 SMOKE GREEN: real Groth16 proof verified on testnet ==="
else
  echo
  echo "=== TIER 1.3 SMOKE RED: verify_one returned $RESULT (expected true) ==="
  exit 1
fi
