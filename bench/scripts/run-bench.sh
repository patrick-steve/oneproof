#!/usr/bin/env bash
# Tier 1.3 bench — measure naive (M `verify_one` txs) vs batched (1
# `batch_verify` tx) on Stellar testnet at M=4. Writes bench/results.json
# with real fee_charged values from Horizon.
#
# Re-uses the contract already deployed by deploy-and-smoke.sh
# (bench/out/contract_id).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO"

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

NETWORK="testnet"
SOURCE="alice"
OUT="$REPO/bench/out"
CIRCUIT_DIR="$REPO/circuits/groth16_batch"
M="${M:-4}"

CONTRACT_ID="$(cat "$OUT/contract_id")"
echo "=== bench against $CONTRACT_ID, M=$M ==="

mkdir -p "$OUT/proofs"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [1/4] generate $M distinct proofs ==="
PROVE_START=$(date +%s%N)
for i in $(seq 0 $((M - 1))); do
  SECRET=$((7 + i))
  INPUT="$OUT/proofs/input_$i.json"
  WTNS="$OUT/proofs/witness_$i.wtns"
  PROOF="$OUT/proofs/proof_$i.json"
  PUBLIC="$OUT/proofs/public_$i.json"

  ( cd "$CIRCUIT_DIR" && npx tsx generate-input.ts "$SECRET" "$INPUT" )

  node "$CIRCUIT_DIR/target/circuit_js/generate_witness.js" \
    "$CIRCUIT_DIR/target/circuit_js/circuit.wasm" \
    "$INPUT" "$WTNS"

  snarkjs groth16 prove \
    "$CIRCUIT_DIR/target/circuit_final.zkey" \
    "$WTNS" "$PROOF" "$PUBLIC"

  ( cd "$REPO/bench" && npx tsx src/snarkjs-to-soroban.ts proof "$PROOF" "$PUBLIC" "$OUT/proofs/cli_$i" )
done
PROVE_END=$(date +%s%N)
PROVE_MS=$(( (PROVE_END - PROVE_START) / 1000000 ))
echo "    generated $M proofs in ${PROVE_MS}ms total"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [2/4] naive: $M individual verify_one txs ==="
NAIVE_TXS=()
for i in $(seq 0 $((M - 1))); do
  LOG="$OUT/proofs/naive_$i.log"
  for attempt in 1 2 3; do
    if stellar contract invoke \
        --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
        -- verify_one \
        --proof "$(cat "$OUT/proofs/cli_$i/proof.cli.json")" \
        --public_inputs "$(cat "$OUT/proofs/cli_$i/public_inputs.cli.json")" \
        > "$OUT/proofs/naive_$i.out" 2> "$LOG"; then
      break
    fi
    [ "$attempt" -lt 3 ] && { echo "    naive[$i] attempt $attempt failed; retry in 5s"; sleep 5; }
  done
  TX_HASH="$(grep -oE 'explorer/testnet/tx/[0-9a-f]{64}' "$LOG" | head -1 | sed 's|explorer/testnet/tx/||')"
  if [ -z "$TX_HASH" ]; then
    echo "    naive[$i] FAILED to extract tx hash from log:"
    tail -10 "$LOG" | sed 's/^/      /'
    exit 1
  fi
  NAIVE_TXS+=("$TX_HASH")
  echo "    naive[$i] tx: $TX_HASH"
done

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [3/4] batched: 1 batch_verify tx with $M proofs ==="
# Build the proofs JSON array: each element is {a, b, c} struct
PROOFS_JSON='['
for i in $(seq 0 $((M - 1))); do
  [ "$i" -gt 0 ] && PROOFS_JSON+=','
  PROOFS_JSON+="$(cat "$OUT/proofs/cli_$i/proof.cli.json")"
done
PROOFS_JSON+=']'

# Build the public_inputs JSON: array of arrays
INPUTS_JSON='['
for i in $(seq 0 $((M - 1))); do
  [ "$i" -gt 0 ] && INPUTS_JSON+=','
  INPUTS_JSON+="$(cat "$OUT/proofs/cli_$i/public_inputs.cli.json")"
done
INPUTS_JSON+=']'

BATCH_LOG="$OUT/proofs/batch.log"
for attempt in 1 2 3; do
  if stellar contract invoke \
      --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
      -- batch_verify \
      --proofs "$PROOFS_JSON" \
      --public_inputs "$INPUTS_JSON" \
      > "$OUT/proofs/batch.out" 2> "$BATCH_LOG"; then
    break
  fi
  [ "$attempt" -lt 3 ] && { echo "    batch attempt $attempt failed; retry in 5s"; sleep 5; }
done
BATCH_TX="$(grep -oE 'explorer/testnet/tx/[0-9a-f]{64}' "$BATCH_LOG" | head -1 | sed 's|explorer/testnet/tx/||')"
if [ -z "$BATCH_TX" ]; then
  echo "    batch FAILED to extract tx hash:"; tail -10 "$BATCH_LOG" | sed 's/^/      /'; exit 1
fi
echo "    batch tx: $BATCH_TX"
echo "    batch returned: $(cat "$OUT/proofs/batch.out")"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [4/4] fetch fees from Horizon + write results.json ==="
echo "    settling 20s for tx inclusion + Horizon ingestion..."
sleep 20

fetch_fee() {
  local tx="$1"
  for attempt in 1 2 3 4 5; do
    local resp
    resp="$(curl -sf "https://horizon-testnet.stellar.org/transactions/$tx" || true)"
    if [ -n "$resp" ]; then
      echo "$resp" | jq -r '.fee_charged'
      return 0
    fi
    sleep 5
  done
  echo "ERROR_no_fee"
  return 1
}

NAIVE_FEES=()
NAIVE_TOTAL=0
for tx in "${NAIVE_TXS[@]}"; do
  FEE="$(fetch_fee "$tx")"
  NAIVE_FEES+=("$FEE")
  NAIVE_TOTAL=$((NAIVE_TOTAL + FEE))
done
BATCH_FEE="$(fetch_fee "$BATCH_TX")"
echo "    naive fees: ${NAIVE_FEES[*]}  → sum $NAIVE_TOTAL stroops"
echo "    batch fee : $BATCH_FEE stroops"

# results.json
NARGO_VER="$(nargo --version 2>/dev/null | head -1 | awk '{print $3}' || echo "1.0.0-beta.9")"
BB_VER="$(bb --version 2>/dev/null | head -1 || echo "0.87.0")"
STELLAR_VER="$(stellar --version 2>/dev/null | head -1 | awk '{print $2}' || echo "26.1.0")"

cat > "$REPO/bench/results.json" <<EOF
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "network": "testnet",
  "contract": "$CONTRACT_ID",
  "versions": {
    "nargo": "$NARGO_VER",
    "bb": "$BB_VER",
    "soroban": "$STELLAR_VER",
    "circom": "2.2.3",
    "snarkjs": "0.7.6"
  },
  "runs": [
    {
      "mode": "naive",
      "n": $M,
      "resourceFeeStroops": $NAIVE_TOTAL,
      "txCount": $M,
      "perTxStroops": [$(IFS=, ; echo "${NAIVE_FEES[*]}")],
      "txHashes": [$(printf '"%s",' "${NAIVE_TXS[@]}" | sed 's/,$//')],
      "proveMsTotal": $PROVE_MS
    },
    {
      "mode": "batch",
      "n": $M,
      "resourceFeeStroops": $BATCH_FEE,
      "txCount": 1,
      "txHashes": ["$BATCH_TX"],
      "proveMsTotal": $PROVE_MS
    }
  ]
}
EOF

echo
echo "=== TIER 1.3 BENCH GREEN: bench/results.json written ==="
echo
echo "  M=$M naive total: $NAIVE_TOTAL stroops across $M txs"
echo "  M=$M batched    : $BATCH_FEE stroops in 1 tx"
echo "  savings         : $((NAIVE_TOTAL - BATCH_FEE)) stroops ($((100 * (NAIVE_TOTAL - BATCH_FEE) / NAIVE_TOTAL))%)"
