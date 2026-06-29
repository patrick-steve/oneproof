// Wraps nargo + bb invocations as awaitable functions returning the
// proof bytes / public-inputs bytes the chain expects. The two binaries
// are filesystem-driven: they read a Prover.toml + circuit JSON, write
// proof files to a directory. We shell out, marshal the IO into temp
// dirs per request, and clean up after.
//
// Why shell out and not use a library: bb has no working Node bindings.
// The Noir TS bindings (@noir-lang/noir_js) handle witness generation
// but bb itself is the only path to UltraHonk proofs. Shell-out is the
// honest interface.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const exec = promisify(execFile);

const CIRCUITS_DIR = process.env.CIRCUITS_DIR ?? "/app/circuits";
const INNER_PKG    = "inner_transfer";
const AGG_PKG      = "aggregator";
const DERIVE_PKG   = "derive_inputs";

// Cached so we don't re-read on every request.
let innerVkFieldsCache: string[] | null = null;

// ─── Public API ────────────────────────────────────────────────────────

export interface InnerProofResult {
  /** UltraHonk proof bytes — what gets submitted to the contract. */
  proofBytes: Uint8Array;
  /** Public-inputs bytes — what the verifier compares against. */
  publicInputsBytes: Uint8Array;
  /** Field representation of the proof, needed when this proof is one of
   * the K inputs to the aggregator circuit (the aggregator's Prover.toml
   * wants proofs in field-array form, not raw bytes). */
  proofFields: string[];
  /** Field representation of the inner public inputs (root, nullifier).
   * Length is always 2 for inner_transfer. */
  publicInputsFields: string[];
  /** SHA-derived id for cache/keying — useful for the pool. */
  id: string;
}

export interface OuterProofResult {
  proofBytes: Uint8Array;
  publicInputsBytes: Uint8Array;
}

/** Inputs the user supplies via the frontend. */
export interface InnerInputs {
  /** Plain integer amount, as a string ("1000"). */
  amount: string;
  /** Free-form user nickname; hashed into the secret field element. */
  nickname: string;
}

// ─── Inner proof ───────────────────────────────────────────────────────

export async function proveInner(input: InnerInputs): Promise<InnerProofResult> {
  const work = await mkdtemp(join(tmpdir(), "op-inner-"));
  try {
    // 1. Derive the user's private inputs deterministically from their
    //    nickname + amount. Same nickname → same secret → reproducible
    //    proof. Different nicknames → different commitments → distinct
    //    proofs flowing into the aggregator.
    const secret   = deriveSecretFromNickname(input.nickname);
    const blinding = deriveBlindingFromNickname(input.nickname);
    const amount   = input.amount;

    // 2. Compute the public outputs the inner_transfer circuit will need
    //    (commitment, merkle root, nullifier, path siblings) by running
    //    the derive_inputs helper circuit. It does the same pedersen
    //    hashing inner_transfer does internally; we just need the values
    //    AHEAD of time to write a valid Prover.toml.
    const derived = await deriveInputsViaCircuit(secret, amount, blinding);
    const merkle = {
      root:         derived.root,
      nullifier:    derived.nullifier,
      pathElements: derived.pathElements,
    };

    // 3. Write Prover.toml into the inner_transfer circuit dir. nargo
    //    looks for it relative to the package; we point at our copy of
    //    the circuits and override with a per-request Prover.toml.
    const pkgDir = join(CIRCUITS_DIR, INNER_PKG);
    const proverToml = buildInnerProverToml({
      root: merkle.root, nullifier: merkle.nullifier,
      secret, amount, blinding, pathElements: merkle.pathElements,
    });
    const proverTomlPath = join(work, "Prover.toml");
    await writeFile(proverTomlPath, proverToml, "utf8");

    // 4. nargo execute (writes witness target/<pkg>.gz inside pkgDir).
    //    We use --prover-name to point nargo at our per-request toml.
    await exec("nargo", [
      "execute",
      "--package", INNER_PKG,
      "--prover-name", proverTomlPath,
      INNER_PKG,
    ], { cwd: pkgDir, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });

    // 5. bb prove → proof + public_inputs files in `work/proof-out/`
    // --num_threads 4: bb defaults to 2 threads even on 4-vCPU machines;
    // explicit 4 cuts FFT + MSM wall-clock by ~30-40% on performance-2x.
    const outDir = join(work, "proof-out");
    await mkdir(outDir, { recursive: true });
    await exec("bb", [
      "prove",
      "--scheme", "ultra_honk",
      "--honk_recursion", "1",
      "--init_kzg_accumulator",
      "--output_format", "bytes_and_fields",
      "-b", join(pkgDir, "target", `${INNER_PKG}.json`),
      "-w", join(pkgDir, "target", `${INNER_PKG}.gz`),
      "-o", outDir,
    ], { maxBuffer: 256 * 1024 * 1024, timeout: 300_000 });

    // 6. Read the four artefacts.
    const [proofBytes, publicInputsBytes, proofFieldsJson, piFieldsJson] = await Promise.all([
      readFile(join(outDir, "proof")),
      readFile(join(outDir, "public_inputs")),
      readFile(join(outDir, "proof_fields.json"), "utf8"),
      readFile(join(outDir, "public_inputs_fields.json"), "utf8"),
    ]);

    return {
      proofBytes:         new Uint8Array(proofBytes),
      publicInputsBytes:  new Uint8Array(publicInputsBytes),
      proofFields:        JSON.parse(proofFieldsJson),
      publicInputsFields: JSON.parse(piFieldsJson),
      id: shortHashHex(proofBytes),
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// ─── Outer (aggregator) proof ─────────────────────────────────────────

/** Aggregate 4 inner proofs into a single outer proof. All 4 inners
 * MUST come from the same inner_transfer VK (which is constant for our
 * pinned circuit, so this always holds in practice). */
export async function proveAggregate(inners: InnerProofResult[]): Promise<OuterProofResult> {
  if (inners.length !== 4) {
    throw new Error(`aggregator expects exactly 4 inner proofs, got ${inners.length}`);
  }
  const work = await mkdtemp(join(tmpdir(), "op-agg-"));
  try {
    const vkFields = await loadInnerVkFields();
    const keyHash  = await loadInnerKeyHash();

    // Flatten public inputs: [root_0, nf_0, ..., root_3, nf_3]
    const flatPublicInputs: string[] = [];
    for (const i of inners) {
      if (i.publicInputsFields.length !== 2) {
        throw new Error(`inner publicInputsFields must be length 2 (root, nf), got ${i.publicInputsFields.length}`);
      }
      flatPublicInputs.push(...i.publicInputsFields);
    }

    const aggToml = buildAggregatorProverToml({
      verificationKey: vkFields,
      keyHash,
      proofs: inners.map((i) => i.proofFields),
      publicInputs: flatPublicInputs,
    });
    const aggTomlPath = join(work, "Prover.toml");
    await writeFile(aggTomlPath, aggToml, "utf8");

    const pkgDir = join(CIRCUITS_DIR, AGG_PKG);

    await exec("nargo", [
      "execute",
      "--package", AGG_PKG,
      "--prover-name", aggTomlPath,
      AGG_PKG,
    ], { cwd: pkgDir, maxBuffer: 64 * 1024 * 1024, timeout: 300_000 });

    const outDir = join(work, "proof-out");
    await mkdir(outDir, { recursive: true });
    await exec("bb", [
      "prove",
      "--scheme", "ultra_honk",
      "--honk_recursion", "1",
      "--init_kzg_accumulator",
      "--output_format", "bytes_and_fields",
      "-b", join(pkgDir, "target", `${AGG_PKG}.json`),
      "-w", join(pkgDir, "target", `${AGG_PKG}.gz`),
      "-o", outDir,
    ], { maxBuffer: 256 * 1024 * 1024, timeout: 600_000 });

    const [proofBytes, publicInputsBytes] = await Promise.all([
      readFile(join(outDir, "proof")),
      readFile(join(outDir, "public_inputs")),
    ]);

    return {
      proofBytes:        new Uint8Array(proofBytes),
      publicInputsBytes: new Uint8Array(publicInputsBytes),
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

// BN254 scalar field modulus r (the Fr the inner_transfer circuit lives in).
const BN254_R = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

// Special-case for the demo default. When nickname is "anon" we map to
// the canonical (secret=7, blinding=42) used to bake the cached outer
// proof shipped with the container. This keeps "click the demo with
// default inputs" → instant cache hit. Any non-default nickname
// derives fresh values and live-proves.
const DEMO_NICK   = "anon";
const DEMO_SECRET = "7";
const DEMO_BLINDING = "42";

function deriveSecretFromNickname(nick: string): string {
  const n = nick || DEMO_NICK;
  if (n === DEMO_NICK) return DEMO_SECRET;
  // Deterministic SHA-256 of the nickname → big-endian integer → mod r.
  // BN254 r < 2^254 so a 256-bit digest can exceed r; reduce explicitly.
  const enc = new TextEncoder().encode(n);
  const digest = createHash("sha256").update(enc).digest();
  let x = 0n;
  for (const b of digest) x = (x << 8n) | BigInt(b);
  return (x % BN254_R).toString();
}

function deriveBlindingFromNickname(nick: string): string {
  const n = nick || DEMO_NICK;
  if (n === DEMO_NICK) return DEMO_BLINDING;
  // Distinct domain separation so blinding and secret can't collide
  // even if someone reuses a nickname.
  const enc = new TextEncoder().encode("blinding|" + n);
  const digest = createHash("sha256").update(enc).digest();
  let x = 0n;
  for (const b of digest) x = (x << 8n) | BigInt(b);
  return (x % BN254_R).toString();
}

interface DerivedInputs {
  commitment:   string;
  root:         string;
  nullifier:    string;
  pathElements: string[];
}

// Run the derive_inputs helper circuit. Takes ~1-2s. We parse stdout
// between the OP_DERIVED_START/END markers we emit from println.
async function deriveInputsViaCircuit(
  secret: string, amount: string, blinding: string,
): Promise<DerivedInputs> {
  const work = await mkdtemp(join(tmpdir(), "op-derive-"));
  try {
    const toml = `secret   = "${secret}"\namount   = "${amount}"\nblinding = "${blinding}"\n`;
    const tomlPath = join(work, "Prover.toml");
    await writeFile(tomlPath, toml, "utf8");
    const pkgDir = join(CIRCUITS_DIR, DERIVE_PKG);
    const { stdout } = await exec("nargo", [
      "execute",
      "--package", DERIVE_PKG,
      "--prover-name", tomlPath,
      DERIVE_PKG,
    ], { cwd: pkgDir, maxBuffer: 16 * 1024 * 1024, timeout: 60_000 });
    return parseDerivedStdout(stdout);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

function parseDerivedStdout(stdout: string): DerivedInputs {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  const startIdx = lines.findIndex((l) => l === "OP_DERIVED_START");
  const endIdx   = lines.findIndex((l) => l === "OP_DERIVED_END");
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    throw new Error("derive_inputs stdout missing OP_DERIVED markers");
  }
  const inner = lines.slice(startIdx + 1, endIdx);
  let i = 0;
  const expectLabel = (want: string) => {
    if (inner[i] !== want) throw new Error(`derive_inputs: expected '${want}' at line ${i}, got '${inner[i]}'`);
    i++;
  };
  const readField = () => {
    const v = inner[i++];
    if (!v) throw new Error(`derive_inputs: missing field at line ${i - 1}`);
    return v;
  };
  expectLabel("commitment"); const commitment = readField();
  expectLabel("root");       const root       = readField();
  expectLabel("nullifier");  const nullifier  = readField();
  expectLabel("path_elements_start");
  const pathElements: string[] = [];
  for (let j = 0; j < 16; j++) pathElements.push(readField());
  return { commitment, root, nullifier, pathElements };
}

// (canonicalEmptyTreeForLeafZero + EMPTY_TREE_PATH_ELEMENTS removed —
// values are now computed live from user inputs via deriveInputsViaCircuit
// above. Every call produces a fresh, input-specific (root, nullifier,
// pathElements) tuple.)

function buildInnerProverToml(args: {
  root: string; nullifier: string;
  secret: string; amount: string; blinding: string;
  pathElements: string[];
}): string {
  const path_indices = Array(16).fill('"0"').join(",");
  const path_elements = args.pathElements.map((e) => `"${e}"`).join(",");
  return [
    `root      = "${args.root}"`,
    `nullifier = "${args.nullifier}"`,
    `secret    = "${args.secret}"`,
    `amount    = "${args.amount}"`,
    `blinding  = "${args.blinding}"`,
    `path_elements = [${path_elements}]`,
    `path_indices  = [${path_indices}]`,
    "",
  ].join("\n");
}

function buildAggregatorProverToml(args: {
  verificationKey: string[];
  keyHash: string;
  proofs: string[][];
  publicInputs: string[];
}): string {
  const vkArr = args.verificationKey.map((s) => `"${s}"`).join(",");
  const piArr = args.publicInputs.map((s) => `"${s}"`).join(",");
  const proofsArr = args.proofs.map(
    (p) => `[${p.map((s) => `"${s}"`).join(",")}]`,
  ).join(",\n  ");
  return [
    `verification_key = [${vkArr}]`,
    `key_hash = "${args.keyHash}"`,
    `public_inputs = [${piArr}]`,
    `proofs = [\n  ${proofsArr}\n]`,
    "",
  ].join("\n");
}

async function loadInnerVkFields(): Promise<string[]> {
  if (innerVkFieldsCache) return innerVkFieldsCache;
  const p = join(CIRCUITS_DIR, INNER_PKG, "target", "vk_fields.json");
  const raw = await readFile(p, "utf8");
  innerVkFieldsCache = JSON.parse(raw);
  return innerVkFieldsCache!;
}

// key_hash is the first element of vk_fields.json in bb v0.87.0's
// recursive-friendly VK format. This convention is fragile; if bb's VK
// layout changes, this constant lookup must change with it.
async function loadInnerKeyHash(): Promise<string> {
  const vk = await loadInnerVkFields();
  if (!vk.length) throw new Error("inner vk_fields.json is empty");
  return vk[0]!;
}

function shortHashHex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}
