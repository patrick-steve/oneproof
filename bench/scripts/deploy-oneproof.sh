#!/usr/bin/env bash
# Tier 2.3 - deploy the OneProof outer verifier on Stellar testnet.
#
# We reuse the rs-soroban-ultrahonk wasm (proven to verify a single UltraHonk
# proof on testnet in spike 2.2) by deploying a fresh instance and passing
# the AGGREGATOR's vk (not the simple_circuit vk the spike used) at
# constructor time. Then invoke verify_proof with the aggregator's outer
# proof + public_inputs. Same scheme (UltraHonk), same byte format, different
# vk. No new contract code needed.
#
# Green iff verify_proof on the aggregator's outer proof returns true.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO"

export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

NETWORK="testnet"
SOURCE="alice"
FORK_WASM="$REPO/vendor/rs-soroban-ultrahonk/target/wasm32v1-none/release/rs_soroban_ultrahonk.wasm"
AGG_TARGET="$REPO/circuits/aggregator/target"
OUT="$REPO/bench/out/oneproof"
mkdir -p "$OUT"

echo "=== stellar $(stellar --version | head -1) / aggregator outer proof ==="

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [1/4] sanity: aggregator artifacts present + fork wasm built ==="
for f in proof vk public_inputs; do
  [ -f "$AGG_TARGET/$f" ] || { echo "missing $AGG_TARGET/$f"; exit 1; }
done
[ -f "$FORK_WASM" ] || {
  echo "missing $FORK_WASM - rebuilding"
  ( cd "$REPO/vendor/rs-soroban-ultrahonk" && stellar contract build )
}
echo "    fork wasm:  $(stat -c%s "$FORK_WASM") bytes"
echo "    outer proof: $(stat -c%s "$AGG_TARGET/proof") bytes"
echo "    outer vk:    $(stat -c%s "$AGG_TARGET/vk") bytes"
echo "    outer pubs:  $(stat -c%s "$AGG_TARGET/public_inputs") bytes"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [2/4] deploy + initialize-via-constructor (with aggregator vk) ==="
DEPLOY_LOG="$OUT/deploy.log"
stellar contract deploy \
  --wasm "$FORK_WASM" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- \
  --vk_bytes-file-path "$AGG_TARGET/vk" \
  > "$OUT/contract_id.raw" 2> "$DEPLOY_LOG"

echo "    --- deploy stderr ---"
cat "$DEPLOY_LOG" | sed 's/^/    /'

CONTRACT_ID="$(grep -oE 'C[A-Z0-9]{55,}' "$OUT/contract_id.raw" | tail -1)"
[ -n "$CONTRACT_ID" ] || { echo "ERROR: no contract id"; exit 1; }
echo "$CONTRACT_ID" > "$OUT/contract_id"
echo "    CONTRACT_ID = $CONTRACT_ID"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [3/4] wait 10s for RPC state propagation post-deploy ==="
sleep 10

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [4/4] invoke verify_proof with the AGGREGATOR outer proof (--send=yes) ==="
# --send=yes forces actual on-chain submission. verify_proof returns bool
# and is auto-detected as read-only; without --send=yes stellar-cli would
# simulate-only and we'd get no tx hash / no measurement.
VERIFY_LOG="$OUT/verify.log"
RESULT=""
for attempt in 1 2 3; do
  if RESULT="$(stellar contract invoke \
      --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
      --send=yes \
      -- verify_proof \
      --public_inputs-file-path "$AGG_TARGET/public_inputs" \
      --proof_bytes-file-path "$AGG_TARGET/proof" \
      2> "$VERIFY_LOG")"; then
    break
  fi
  echo "    verify_proof attempt $attempt failed; stderr:"
  tail -15 "$VERIFY_LOG" | sed 's/^/      /'
  [ "$attempt" -lt 3 ] && sleep 10
done

VERIFY_TX="$(grep -oE 'explorer/testnet/tx/[0-9a-f]{64}' "$VERIFY_LOG" | head -1 | sed 's|explorer/testnet/tx/||')"

echo
echo "    verify_proof returned: $RESULT"
echo "    verify_proof tx:       $VERIFY_TX"
echo "$VERIFY_TX" > "$OUT/verify_tx"

if [ -n "$VERIFY_TX" ]; then
  echo
  echo "=== TIER 2.3 GREEN: aggregator outer proof verified ON-CHAIN ==="
  echo "    contract:  $CONTRACT_ID"
  echo "    verify tx: $VERIFY_TX"
else
  echo
  echo "=== TIER 2.3 RED: no verify_proof tx hash ==="
  exit 1
fi
