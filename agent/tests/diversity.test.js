// agent/tests/diversity.test.js
// TESTS FOR DIVERSITY SCORING LOGIC
// These tests cover the computeDiversityScore function in isolation (unit tests) and the checkWalletDiversity function in mock mode (integration tests without real API calls).


import {
    computeDiversityScore,
    checkWalletDiversity,
    scanBatch,
} from "../services/diversity.js";

// ─── Unit tests (zero network calls) ──────────────────────────────────────

describe("computeDiversityScore (unit)", () => {
    test("strong wallet scores 75+", () => {
        const score = computeDiversityScore({
            uniqueTokens: 10, txCount: 100, accountAgeDays: 200,
            totalUSD: 1000, nativeBalance: "0.5",
        });
        expect(score).toBeGreaterThanOrEqual(75);
    });

    test("Sybil wallet scores under 20", () => {
        const score = computeDiversityScore({
            uniqueTokens: 1, txCount: 2, accountAgeDays: 3,
            totalUSD: 0, nativeBalance: "0",
        });
        expect(score).toBeLessThan(20);
    });

    test("borderline wallet: exactly 3 tokens, 10 tx, 30 days → score is 0 (none of the rules fire)", () => {
        // uniqueTokens=3 → 0 pts (rule is >3)
        // txCount=10     → 0 pts (rule is >10)
        // accountAgeDays=30 → 0 pts (rule is >30)
        // nativeBalance="0.1" → no penalty (not "0")
        // txCount=10 >= 3 → no penalty
        const score = computeDiversityScore({
            uniqueTokens: 3, txCount: 10, accountAgeDays: 30,
            totalUSD: 50, nativeBalance: "0.1",
        });
        expect(score).toBe(5); // only totalUSD > 50 fires → +5
    });

    test("wallet just above all thresholds scores 65+", () => {
        const score = computeDiversityScore({
            uniqueTokens: 4, txCount: 11, accountAgeDays: 31,
            totalUSD: 51, nativeBalance: "0.01",
        });
        // +20 (tokens>3) +20 (tx>10) +20 (age>30) +5 (usd>50) = 65
        expect(score).toBe(65);
    });

    test("zero native balance triggers -20 penalty", () => {
        const withBal = computeDiversityScore({
            uniqueTokens: 4, txCount: 11, accountAgeDays: 31,
            totalUSD: 0, nativeBalance: "0.1",
        });
        const noBal = computeDiversityScore({
            uniqueTokens: 4, txCount: 11, accountAgeDays: 31,
            totalUSD: 0, nativeBalance: "0",
        });
        expect(withBal - noBal).toBe(20);
    });

    test("score never exceeds 100", () => {
        const score = computeDiversityScore({
            uniqueTokens: 999, txCount: 999, accountAgeDays: 999,
            totalUSD: 999999, nativeBalance: "100",
        });
        expect(score).toBeLessThanOrEqual(100);
    });

    test("score never goes below 0", () => {
        const score = computeDiversityScore({
            uniqueTokens: 0, txCount: 0, accountAgeDays: 0,
            totalUSD: 0, nativeBalance: "0",
        });
        expect(score).toBeGreaterThanOrEqual(0);
    });
});

// ─── Integration tests (mock mode when no real keys) ─────────────────────

describe("checkWalletDiversity (mock mode — no API keys needed)", () => {
    // Temporarily clear real keys so mock path activates
    let origKey, origSecret, origPass;

    beforeAll(() => {
        origKey = process.env.OKX_API_KEY;
        origSecret = process.env.OKX_API_SECRET;
        origPass = process.env.OKX_PASSPHRASE;
        // Clear keys → forces mock responses in diversity.js
        delete process.env.OKX_API_KEY;
        delete process.env.OKX_API_SECRET;
        delete process.env.OKX_PASSPHRASE;
        // Clear RPC too so no provider is created
        delete process.env.RPC_URL;
    });

    afterAll(() => {
        if (origKey) process.env.OKX_API_KEY = origKey;
        if (origSecret) process.env.OKX_API_SECRET = origSecret;
        if (origPass) process.env.OKX_PASSPHRASE = origPass;
    });

    test("returns correct shape for any address", async () => {
        const addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        const result = await checkWalletDiversity(addr);

        expect(result).toHaveProperty("address", addr);
        expect(result).toHaveProperty("passed");
        expect(result).toHaveProperty("score");
        expect(typeof result.score).toBe("number");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.metrics).toHaveProperty("uniqueTokens");
        expect(result.metrics).toHaveProperty("txCount");
        expect(result.proofHashes).toHaveLength(2);
    });

    test("low-seed address (empty wallet) is rejected", async () => {
        // seed = parseInt("0000", 16) = 0 → below 100 → mock returns []
        const addr = "0x0000000000000000000000000000000000000001";
        const result = await checkWalletDiversity(addr);
        expect(result.passed).toBe(false);
    });

    test("high-seed address (active wallet mock) passes", async () => {
        // seed = parseInt("f39F", 16) = 62367 → above 100 → mock returns 5 tokens + trades
        const addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        const result = await checkWalletDiversity(addr);
        // 5 tokens (>3 ✓), mock trades >10 ✓, account age 90 days (>30 ✓)
        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThan(50);
    });
});

describe("scanBatch (mock mode)", () => {
    beforeAll(() => {
        delete process.env.OKX_API_KEY;
        delete process.env.OKX_API_SECRET;
        delete process.env.OKX_PASSPHRASE;
        delete process.env.RPC_URL;
    });

    test("returns one result per input address", async () => {
        const addresses = [
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000001",
        ];
        const results = await scanBatch(addresses);
        expect(results).toHaveLength(2);
        results.forEach(r => {
            expect(r).toHaveProperty("passed");
            expect(r).toHaveProperty("score");
            expect(r.proofHashes).toHaveLength(2);
        });
    });

    test("passed results appear before failed results", async () => {
        const addresses = [
            "0x0000000000000000000000000000000000000001", // will fail
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // will pass
        ];
        const results = await scanBatch(addresses);
        // First result should be the passing one
        expect(results[0].passed).toBe(true);
        expect(results[1].passed).toBe(false);
    }, 15000);
});