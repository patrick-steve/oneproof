// Convert snarkjs's JSON formats (vkey.json / proof.json / public.json)
// into the byte-encoded JSON that `stellar contract invoke` accepts for
// our contracts/groth16_batch_verifier/{VkBytes, Groth16ProofBytes,
// PublicInputs} types.
//
// snarkjs gives BN254 points as decimal-string nested arrays:
//   G1: [x_dec, y_dec, z_dec]                              z=1 (affine)
//   G2: [[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]]         z=[1,0] (affine)
//   Fr: "decimal_string"
//
// Soroban / our contract takes:
//   G1 (BytesN<64>):  0x ‖ be(x) ‖ be(y)                       (128 hex chars)
//   G2 (BytesN<128>): 0x ‖ be(x_c1) ‖ be(x_c0) ‖ be(y_c1) ‖ be(y_c0)
//                                                              EVM/Soroban
//                                                              convention,
//                                                              c1-first.
//   Fr (BytesN<32>):  0x ‖ be(x)                                (64 hex chars)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function decToBe32(dec: string | bigint): Buffer {
  const n = BigInt(dec);
  if (n < 0n) throw new Error(`negative scalar: ${dec}`);
  const hex = n.toString(16).padStart(64, "0");
  if (hex.length !== 64) throw new Error(`scalar >32 bytes: ${dec}`);
  return Buffer.from(hex, "hex");
}

export function g1ToHex(pt: string[]): string {
  if (pt.length !== 3) throw new Error(`bad G1 length: ${pt.length}`);
  // snarkjs always emits affine z=1 for verifier-output points; sanity-check
  if (BigInt(pt[2]) !== 1n) {
    throw new Error(`G1 not affine (z=${pt[2]}); snarkjs unexpectedly non-affine`);
  }
  return Buffer.concat([decToBe32(pt[0]), decToBe32(pt[1])]).toString("hex");
}

export function g2ToHex(pt: string[][]): string {
  if (pt.length !== 3 || pt[0].length !== 2) throw new Error(`bad G2 shape`);
  if (BigInt(pt[2][0]) !== 1n || BigInt(pt[2][1]) !== 0n) {
    throw new Error(`G2 not affine (z=[${pt[2]}])`);
  }
  const xC0 = decToBe32(pt[0][0]);
  const xC1 = decToBe32(pt[0][1]);
  const yC0 = decToBe32(pt[1][0]);
  const yC1 = decToBe32(pt[1][1]);
  // EVM/Soroban: c1-first for both x and y
  return Buffer.concat([xC1, xC0, yC1, yC0]).toString("hex");
}

export function frToHex(dec: string): string {
  return decToBe32(dec).toString("hex");
}

export function convertVk(snarkjsVk: any) {
  if (snarkjsVk.protocol !== "groth16") throw new Error(`not groth16: ${snarkjsVk.protocol}`);
  if (snarkjsVk.curve !== "bn128") throw new Error(`not bn254/bn128: ${snarkjsVk.curve}`);
  return {
    alpha: g1ToHex(snarkjsVk.vk_alpha_1),
    beta:  g2ToHex(snarkjsVk.vk_beta_2),
    gamma: g2ToHex(snarkjsVk.vk_gamma_2),
    delta: g2ToHex(snarkjsVk.vk_delta_2),
    ic:    snarkjsVk.IC.map((pt: string[]) => g1ToHex(pt)),
  };
}

export function convertProof(snarkjsProof: any) {
  return {
    a: g1ToHex(snarkjsProof.pi_a),
    b: g2ToHex(snarkjsProof.pi_b),
    c: g1ToHex(snarkjsProof.pi_c),
  };
}

export function convertPublic(snarkjsPub: string[]): string[] {
  return snarkjsPub.map(frToHex);
}

function writeJson(path: string, obj: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2));
  console.error(`wrote ${path}`);
}

// CLI: `tsx snarkjs-to-soroban.ts vk <vkey.json> <out>`
//   or `tsx snarkjs-to-soroban.ts proof <proof.json> <public.json> <out-dir>`
//      writes proof.cli.json + public_inputs.cli.json into <out-dir>
const [mode, ...rest] = process.argv.slice(2);
if (mode === "vk") {
  const [vkPath, outPath] = rest;
  const v = JSON.parse(readFileSync(vkPath, "utf8"));
  writeJson(outPath, convertVk(v));
} else if (mode === "proof") {
  const [proofPath, publicPath, outDir] = rest;
  const p = JSON.parse(readFileSync(proofPath, "utf8"));
  const pub = JSON.parse(readFileSync(publicPath, "utf8"));
  writeJson(`${outDir}/proof.cli.json`, convertProof(p));
  writeJson(`${outDir}/public_inputs.cli.json`, convertPublic(pub));
} else if (mode) {
  console.error(`unknown mode: ${mode}`);
  console.error(`usage: tsx snarkjs-to-soroban.ts vk <vkey.json> <out.json>`);
  console.error(`       tsx snarkjs-to-soroban.ts proof <proof.json> <public.json> <out-dir>`);
  process.exit(2);
}
