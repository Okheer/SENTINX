// agent/tests/yield.test.js — FIXED

// Set env BEFORE any imports — same pattern as attestation.test.js
process.env.SENTRY_PRIVATE_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// Do NOT set RPC_URL or contract addresses — prevents real network calls
delete process.env.RPC_URL;
delete process.env.SENTINX_ESCROW_ADDRESS;
delete process.env.OKX_API_KEY;
delete process.env.OKX_API_SECRET;
delete process.env.OKX_PASSPHRASE;

import { ethers } from "ethers";

// Dynamic imports so env vars are set first
let deployToYield, returnFromYield, estimateYield;

beforeAll(async () => {

    const mod = await import("../services/yield.js");
    console.log("MODULE:", mod); // Debug log to check what was imported
    deployToYield = mod.deployToYield;
    returnFromYield = mod.returnFromYield;
    estimateYield = mod.estimateYield;
});

// ─── Unit tests (no network, no contract calls) ───────────────────────────

describe("deployToYield", () => {
    test("throws when SENTINX_ESCROW_ADDRESS is not set", async () => {
        const amount = ethers.parseUnits("10", 6); // 10 USDC
        await expect(deployToYield(amount)).rejects.toThrow(
            "SENTINX_ESCROW_ADDRESS not set"
        );
    });

    test("throws with a BigInt amount (correct type)", async () => {
        const amount = ethers.parseUnits("50", 6);
        expect(typeof amount).toBe("bigint");
        await expect(deployToYield(amount)).rejects.toThrow(
            "SENTINX_ESCROW_ADDRESS not set"
        );
    });
});

describe("returnFromYield", () => {
    test("throws when SENTINX_ESCROW_ADDRESS is not set", async () => {
        const amount = ethers.parseUnits("10", 6);
        await expect(returnFromYield(amount)).rejects.toThrow(
            "SENTINX_ESCROW_ADDRESS not set"
        );
    });
});

describe("estimateYield", () => {
    test("returns zero when no RPC is set (safe fallback)", async () => {
        const amount = ethers.parseUnits("100", 6);
        const result = await estimateYield(amount);

        // Without RPC/DEX client, should return zeros safely
        expect(result).toHaveProperty("earnedUSD");
        expect(result).toHaveProperty("yieldPct");
        expect(result.earnedUSD).toBe(0);
        expect(result.yieldPct).toBe(0);
    });

    test("return shape is always { earnedUSD, yieldPct }", async () => {
        const result = await estimateYield(ethers.parseUnits("0", 6));
        expect(Object.keys(result)).toEqual(
            expect.arrayContaining(["earnedUSD", "yieldPct"])
        );
    });
});

describe("yield amount helpers (pure logic, no network)", () => {
    test("80% of 100 USDC = 80 USDC in BigInt", () => {
        const idle = ethers.parseUnits("100", 6); // 100_000_000n
        const deployRatio = 80n;
        const amount = (idle * deployRatio) / 100n;
        expect(amount).toBe(ethers.parseUnits("80", 6));
    });

    test("ethers.formatUnits converts 6-decimal USDC correctly", () => {
        const raw = ethers.parseUnits("10.5", 6);
        expect(ethers.formatUnits(raw, 6)).toBe("10.5");
    });

    test("BigInt arithmetic does not overflow for large USDC amounts", () => {
        const tenThousandUSDC = ethers.parseUnits("10000", 6);
        const eightyPct = (tenThousandUSDC * 80n) / 100n;
        expect(ethers.formatUnits(eightyPct, 6)).toBe("8000.0");
    });
});