// agent/tests/attestation.test.js — TESTS FOR TEE-BASED ATTESTATION SIGNING
// These tests focus on the attestation signing logic in isolation from the registry contract.
// The attestUser and attestBatch tests check that the correct errors are thrown when the registry is not available.

// Set env BEFORE any imports so modules pick them up
process.env.SENTRY_PRIVATE_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// Do NOT set RPC_URL — prevents JsonRpcProvider from being created
delete process.env.RPC_URL;
delete process.env.IDENTITY_REGISTRY_ADDRESS;
delete process.env.SENTINX_ESCROW_ADDRESS;

import { ethers } from "ethers";

import {
    createAttestationSignature,
    getSentryAddress,
    attestUser,
    attestBatch
} from "../services/attestation.js";

describe("getSentryAddress", () => {
    test("returns a valid Ethereum address", () => {
        const addr = getSentryAddress();
        expect(ethers.isAddress(addr)).toBe(true);
        // The hardhat account #0 address for the test key
        expect(addr.toLowerCase()).toBe(
            "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
        );
        console.log("\n  ✓ Sentry wallet:", addr);
        console.log("  → Share this address with Person A for contract whitelisting!\n");
    });
});

describe("createAttestationSignature", () => {
    test("returns hex signature of correct length", async () => {
        const { signature, messageHash } =
            await createAttestationSignature(
                "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "QmTestCID"
            );

        // Signature is 65 bytes = 130 hex chars + "0x" prefix
        expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
        expect(messageHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    test("signature is recoverable to sentry address", async () => {
        const user = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        const cid = "QmRecoverTest";

        const { signature, messageHash } =
            await createAttestationSignature(user, cid);

        const recovered = ethers.verifyMessage(
            ethers.getBytes(messageHash),
            signature
        );
        expect(recovered.toLowerCase()).toBe(getSentryAddress().toLowerCase());
    });

    test("same inputs → same messageHash (deterministic)", async () => {
        const user = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        const cid = "QmDetermTest";
        const { messageHash: h1 } = await createAttestationSignature(user, cid);
        const { messageHash: h2 } = await createAttestationSignature(user, cid);
        expect(h1).toBe(h2);
    });

    test("different CIDs → different messageHash", async () => {
        const user = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        const { messageHash: h1 } = await createAttestationSignature(user, "QmA");
        const { messageHash: h2 } = await createAttestationSignature(user, "QmB");
        expect(h1).not.toBe(h2);
    });
});

describe("attestUser", () => {
    test("throws if passed=false", async () => {
        await expect(
            attestUser({
                address: "0xFail",
                passed: false,
                score: 10,
                metrics: {},
                proofHashes: [],
            })
        ).rejects.toThrow("diversity check failed");
    });

    test("throws when IDENTITY_REGISTRY_ADDRESS missing (correct error)", async () => {
        await expect(
            attestUser({
                address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                passed: true,
                score: 80,
                metrics: { uniqueTokens: 5, txCount: 20, accountAgeDays: 90 },
                proofHashes: ["0xabc", "0xdef"],
            })
        ).rejects.toThrow("IDENTITY_REGISTRY_ADDRESS not set");
    });
});

describe("attestBatch", () => {
    test("all-failed batch returns empty attested, full rejected", async () => {
        const results = [
            { address: "0x0001", passed: false, score: 5, metrics: {}, proofHashes: [] },
            { address: "0x0002", passed: false, score: 12, metrics: {}, proofHashes: [] },
            { address: "0x0003", passed: false, score: 0, metrics: {}, proofHashes: [] },
        ];
        const { attested, rejected, errors } = await attestBatch(results);
        expect(attested).toHaveLength(0);
        expect(rejected).toHaveLength(3);
        expect(errors).toHaveLength(0);
        expect(rejected[0].address).toBe("0x0001");
    });

    test("mixed batch: passed ones go to errors (no registry), failed to rejected", async () => {
        const results = [
            { address: "0xFail", passed: false, score: 5, metrics: {}, proofHashes: [] },
            {
                address: "0xSuccess", passed: true, score: 80,
                metrics: { uniqueTokens: 5, txCount: 20, accountAgeDays: 90 },
                proofHashes: ["0xabc"]
            },
        ];
        const { attested, rejected, errors } = await attestBatch(results);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].address).toBe("0xFail");
        // The passed one hits the missing-registry error → goes to errors
        expect(errors).toHaveLength(1);
        expect(errors[0].address).toBe("0xSuccess");
        expect(errors[0].error).toContain("IDENTITY_REGISTRY_ADDRESS");
        expect(attested).toHaveLength(0);
    });
});