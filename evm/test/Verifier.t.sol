// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Groth16Verifier} from "../src/Verifier.sol";

contract VerifierTest is Test {
    Groth16Verifier verifier;

    function setUp() public {
        verifier = new Groth16Verifier();
    }

    function test_verifyTier1ProofOnEvm() public view {
        // Auto-generated calldata from the Tier 1 sanity proof (snarkjs
        // groth16 prove of circuits/groth16_batch/circuit.circom).
        // This is the SAME proof bytes that verified on Stellar testnet
        // in tx 99b168d8dae99328021fddcf4ab0889ae8916fa02b834f90e88d5a2fd1e3350d.
        bool ok = verifier.verifyProof(
            [0x059a0bf053b2764eeb8ff158bb14b01b4f4ba18c976fe8757368b16f606eec47, 0x03a68ae59c093cd41c2e1df34f1fe25ff50d45bce5ca9fb16c97548bb6ccd796],[[0x299f1d53e9d46be9a1ba09a79a83ca6c85d93af5fa7ba2fa74cdb219a7f40a36, 0x1308141bdb8a50b9efde8cba28dcb35a070636c52c8e3c1d3f44f8adbaedaa79],[0x09c6b0edfdd2cbcd0bf8c02ba19e0f1738bfc1d2c08fb7be7d27246815aaa6ec, 0x01518cc9e28a690b7ed3d192798744e57a05b9861eef2ea50b1bb6c12f7c8dee]],[0x01f8b38544fc74cc40ca4529fa68654a685edb539dabc199f57bb963d29aab2e, 0x0c6a12c267e2c8c06d7cf0af35a7a07c7c477e638387a4f10e3fc7abb86708ed],[0x09df0fee1c9d08f39945252a26fcaca0854aab076d7f83426952011f583a3166,0x16ff6f564773fa900f5c13ea4b55cd23b7c2e6756644553b115e15174a155a10]
        );
        assertTrue(ok, "Tier 1 Groth16 proof MUST verify on EVM (same BN254)");
    }
}
