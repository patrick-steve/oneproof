// Tests for the pure helpers in prover.ts. Doesn't shell out to nargo
// or bb (those are integration; tested against the deployed backend
// via the smoke scripts in scratchpad/). These tests cover the
// derive-input logic + the stdout-parse logic + the Prover.toml
// builders.

import { describe, expect, it } from "vitest";
import {
  buildInnerProverToml,
  deriveBlindingFromNickname,
  deriveSecretFromNickname,
  parseDerivedStdout,
} from "./prover.js";

const BN254_R = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

describe("deriveSecretFromNickname", () => {
  it("returns the demo-pinned value for the 'anon' default", () => {
    expect(deriveSecretFromNickname("anon")).toBe("7");
  });

  it("empty nickname falls back to anon → 7", () => {
    expect(deriveSecretFromNickname("")).toBe("7");
  });

  it("non-default nicknames yield different in-field values", () => {
    const a = deriveSecretFromNickname("alice");
    const b = deriveSecretFromNickname("bob");
    expect(a).not.toBe(b);
    expect(a).not.toBe("7");
    expect(BigInt(a)).toBeLessThan(BN254_R);
    expect(BigInt(b)).toBeLessThan(BN254_R);
  });

  it("is deterministic across calls", () => {
    expect(deriveSecretFromNickname("alice")).toBe(deriveSecretFromNickname("alice"));
  });
});

describe("deriveBlindingFromNickname", () => {
  it("returns the demo-pinned value for 'anon'", () => {
    expect(deriveBlindingFromNickname("anon")).toBe("42");
  });

  it("non-default nicknames yield distinct values from the secret", () => {
    const secret = deriveSecretFromNickname("alice");
    const blinding = deriveBlindingFromNickname("alice");
    expect(secret).not.toBe(blinding);
    expect(BigInt(blinding)).toBeLessThan(BN254_R);
  });
});

describe("parseDerivedStdout", () => {
  const goodOutput = `
some preamble nargo may print
OP_DERIVED_START
commitment
0xabc
root
0xdef
nullifier
0x123
path_elements_start
0x00
0x01
0x02
0x03
0x04
0x05
0x06
0x07
0x08
0x09
0x0a
0x0b
0x0c
0x0d
0x0e
0x0f
OP_DERIVED_END
trailing nargo output
`;

  it("extracts commitment, root, nullifier, and 16 path elements", () => {
    const out = parseDerivedStdout(goodOutput);
    expect(out.commitment).toBe("0xabc");
    expect(out.root).toBe("0xdef");
    expect(out.nullifier).toBe("0x123");
    expect(out.pathElements).toHaveLength(16);
    expect(out.pathElements[0]).toBe("0x00");
    expect(out.pathElements[15]).toBe("0x0f");
  });

  it("throws when start marker is missing", () => {
    expect(() => parseDerivedStdout("OP_DERIVED_END\ncommitment\n0xabc")).toThrow(/missing OP_DERIVED markers/);
  });

  it("throws when end marker is missing", () => {
    expect(() => parseDerivedStdout("OP_DERIVED_START\ncommitment\n0xabc")).toThrow(/missing OP_DERIVED markers/);
  });

  it("throws on label mismatch", () => {
    const bad = "OP_DERIVED_START\nwrong_label\n0xabc\nOP_DERIVED_END";
    expect(() => parseDerivedStdout(bad)).toThrow(/expected 'commitment'/);
  });
});

describe("buildInnerProverToml", () => {
  it("produces a valid TOML with all six fields", () => {
    const toml = buildInnerProverToml({
      root:         "0xR",
      nullifier:    "0xN",
      secret:       "7",
      amount:       "1000",
      blinding:     "42",
      pathElements: Array(16).fill("0x00"),
    });
    expect(toml).toContain('root      = "0xR"');
    expect(toml).toContain('nullifier = "0xN"');
    expect(toml).toContain('secret    = "7"');
    expect(toml).toContain('amount    = "1000"');
    expect(toml).toContain('blinding  = "42"');
    expect(toml).toContain('path_elements = ["0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00","0x00"]');
    expect(toml).toContain('path_indices  = ["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]');
  });
});
