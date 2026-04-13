// agent/tests/integration.test.js

// Only runs when real contract addresses are set
const SKIP = !process.env.IDENTITY_REGISTRY_ADDRESS ||
    !process.env.SENTINX_ESCROW_ADDRESS ||
    !process.env.OKX_API_KEY;

describe("Live integration — X Layer Testnet", () => {

    (SKIP ? test.skip : test)(
        "diversity scan returns real data from OKX API",
        async () => {
            const { checkWalletDiversity } = await import("../services/diversity.js");
            const result = await checkWalletDiversity(
                "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
            );
            expect(result.passed).toBe(true);
            expect(result.score).toBeGreaterThan(50);
            expect(result.metrics.uniqueTokens).toBeGreaterThan(3);
        },
        20000
    );

    (SKIP ? test.skip : test)(
        "attestation writes real tx to X Layer",
        async () => {
            const { checkWalletDiversity } = await import("../services/diversity.js");
            const { attestUser } = await import("../services/attestation.js");

            const scan = await checkWalletDiversity(
                "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
            );
            const result = await attestUser(scan);

            expect(result.txHash).toBeTruthy();
            expect(result.cid).toMatch(/^Qm/);
            console.log("Live tx hash:", result.txHash);
        },
        30000
    );

    (SKIP ? test.skip : test)(
        "getVerifiedCount reads from real contract",
        async () => {
            const { getVerifiedCount } = await import("../services/attestation.js");
            const count = await getVerifiedCount();
            expect(typeof count).toBe("number");
            expect(count).toBeGreaterThanOrEqual(0);
            console.log("Verified count on-chain:", count);
        },
        10000
    );
});