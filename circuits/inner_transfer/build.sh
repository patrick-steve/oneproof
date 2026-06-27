#!/usr/bin/env bash
# Tier 2.1 — build inner_transfer Noir circuit + run nargo test (which prints
# the public inputs derived for the demo secret), generate Prover.toml from
# those printed values, then nargo execute + bb prove + bb verify.
#
# Green iff `bb verify` returns success on the inner proof.
# The proof is generated with the recursive-friendly bb flags from the
# spike (Poseidon2 transcript, KZG accumulator) so the §4.2 aggregator
# can consume it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"

echo "=== nargo $(nargo --version | head -1) / bb $(bb --version) ==="

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [1/4] nargo test to compute demo public inputs (root, nullifier) ==="
TEST_OUT="$(nargo test --show-output 2>&1)"
if ! echo "$TEST_OUT" | grep -q "INPUTS_FOR_DEMO_START"; then
  echo "ERROR: nargo test did not emit INPUTS_FOR_DEMO marker"
  echo "$TEST_OUT" | tail -40
  exit 1
fi

# Parse the printed values - format is line-per-value, framed by markers.
ROOT_VAL="$(echo "$TEST_OUT" | awk '/^root$/{getline; gsub(/\r/,""); print; exit}')"
NF_VAL="$(echo "$TEST_OUT" | awk '/^nullifier$/{getline; gsub(/\r/,""); print; exit}')"
mapfile -t PATH_ELEMS < <(echo "$TEST_OUT" | awk '/^path_elements_start$/{flag=1; next} /^INPUTS_FOR_DEMO_END$/{flag=0} flag{gsub(/\r/,""); print}')

if [ -z "$ROOT_VAL" ] || [ -z "$NF_VAL" ] || [ ${#PATH_ELEMS[@]} -ne 16 ]; then
  echo "ERROR: failed to parse demo inputs"
  echo "  root='$ROOT_VAL' nullifier='$NF_VAL' path_elements count=${#PATH_ELEMS[@]}"
  echo "$TEST_OUT" | tail -40
  exit 1
fi
echo "    root      = $ROOT_VAL"
echo "    nullifier = $NF_VAL"
echo "    path_elements parsed: ${#PATH_ELEMS[@]}/16"

# Wrap path elements in quotes for TOML.
PATH_TOML_ELEMS=()
for v in "${PATH_ELEMS[@]}"; do PATH_TOML_ELEMS+=("\"$v\""); done

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [2/4] write Prover.toml ==="
PATH_ELEMS_TOML="$(IFS=, ; echo "${PATH_TOML_ELEMS[*]}")"
cat > Prover.toml <<EOF
root      = "$ROOT_VAL"
nullifier = "$NF_VAL"
secret    = "7"
amount    = "1000"
blinding  = "42"
path_elements = [$PATH_ELEMS_TOML]
path_indices  = ["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]
EOF
echo "    wrote Prover.toml"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [3/4] nargo compile + execute (produces witness) ==="
rm -rf target
nargo compile
nargo execute inner_transfer

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [4/4] bb prove + write_vk + verify (recursive-friendly flags) ==="
bb prove \
  --scheme ultra_honk \
  --oracle_hash poseidon2 \
  --honk_recursion 1 \
  --init_kzg_accumulator \
  --bytecode_path target/inner_transfer.json \
  --witness_path target/inner_transfer.gz \
  --output_path target \
  --output_format bytes_and_fields
bb write_vk \
  --scheme ultra_honk \
  --oracle_hash poseidon2 \
  --honk_recursion 1 \
  --init_kzg_accumulator \
  --verifier_type standalone \
  --bytecode_path target/inner_transfer.json \
  --output_path target \
  --output_format bytes_and_fields
bb verify \
  --scheme ultra_honk \
  --oracle_hash poseidon2 \
  --honk_recursion 1 \
  --vk_path target/vk \
  --proof_path target/proof \
  --public_inputs_path target/public_inputs

echo
echo "=== TIER 2.1 GREEN: inner_transfer proves + verifies off-chain ==="
echo "    proof fields: $(jq 'length' target/proof_fields.json) (expect 456)"
echo "    vk    fields: $(jq 'length' target/vk_fields.json)    (expect 112)"
echo "    public inputs: $(jq 'length' target/public_inputs_fields.json)"
