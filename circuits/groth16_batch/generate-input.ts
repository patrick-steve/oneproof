// Generates a satisfying input for circuit.circom.
// CLI: `tsx generate-input.ts [secret] [out-path]`
//
// Default: secret=7, writes input.json.
// Bench:   secret=7..7+M-1, writes input_<secret>.json — distinct nullifiers.
//
// Construction (matches §3.1 statement):
//   amount=1000, blinding=42 (constants)
//   leafIndex=0, all pathIndices=0
//   empty-tree siblings Z[d] = Poseidon(Z[d-1], Z[d-1]) with Z[0]=0
//   root computed bottom-up from the single occupied leaf c
import { buildPoseidon } from "circomlibjs";
import { writeFileSync } from "node:fs";

const D = 16;

(async () => {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const toDec = (x: any) => F.toObject(x).toString();

  const secret = BigInt(process.argv[2] ?? "7");
  const out = process.argv[3] ?? "input.json";
  const amount = 1000n;
  const blinding = 42n;

  const c = poseidon([secret, amount, blinding]);
  const cDec = toDec(c);

  const Z: bigint[] = [0n];
  for (let d = 1; d <= D; d++) {
    const prev = F.e(Z[d - 1]);
    Z.push(BigInt(toDec(poseidon([prev, prev]))));
  }

  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let cur = c;
  for (let i = 0; i < D; i++) {
    const sibling = F.e(Z[i]);
    pathElements.push(Z[i].toString());
    pathIndices.push(0);
    cur = poseidon([cur, sibling]);
  }
  const root = toDec(cur);
  const leafIndex = 0n;
  const nullifier = toDec(poseidon([secret, leafIndex]));

  writeFileSync(out, JSON.stringify({
    root,
    nullifier,
    secret: secret.toString(),
    amount: amount.toString(),
    blinding: blinding.toString(),
    pathElements,
    pathIndices,
  }, null, 2));
  console.log(`wrote ${out}`);
  console.log(`  secret=${secret} → c=${cDec.slice(0, 16)}… root=${root.slice(0, 16)}… nf=${nullifier.slice(0, 16)}…`);
})();
