
// SENTINX Sentry Agent — main autonomous loop.
// Polls for new founder submissions, scans them, attests approved ones,
// triggers milestone release when threshold is met.

// agent/index.js — complete version
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { ethers } from "ethers";

import { scanBatch } from "./services/diversity.js";
import { getVerifiedCount, getSentryAddress, attestBatch }
    from "./services/attestation.js";
import { deployToYield, returnFromYield, estimateYield }
    from "./services/yield.js";

// ── Config ────────────────────────────────────────────────────────────────
const LOOP_MS = 30_000;
const VERIFIED_THRESHOLD = 50;
const YIELD_RATIO = 80n;
const QUEUE_PATH = "/tmp/pending_addresses.json";

// ── State (in-memory) ─────────────────────────────────────────────────────
let cycleCount = 0;
let deployedUSDC = 0n;
let botsRejected = 0;
let humansVerified = 0;
let dealState = "WAITING_FOR_CONTRACTS";

// ── Helpers ───────────────────────────────────────────────────────────────
function readQueue() {
    try {
        if (!existsSync(QUEUE_PATH)) return [];
        return JSON.parse(readFileSync(QUEUE_PATH, "utf8"));
    } catch { return []; }
}

function clearQueue() {
    writeFileSync(QUEUE_PATH, "[]", "utf8");
}

function getEscrow() {
    if (!process.env.SENTINX_ESCROW_ADDRESS) return null;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const sentryWallet = new ethers.Wallet(process.env.SENTRY_PRIVATE_KEY, provider);
    const ABI = [
        "function releaseTranche() external",
        "function state() view returns (uint8)",
        "function getIdleBalance() view returns (uint256)",
    ];
    return new ethers.Contract(
        process.env.SENTINX_ESCROW_ADDRESS, ABI, sentryWallet
    );
}

// ── Main cycle ────────────────────────────────────────────────────────────
async function runCycle() {
    cycleCount++;
    const time = new Date().toLocaleTimeString();
    console.log(`\n[${time}] ════ Cycle #${cycleCount} ════`);

    // ── Step 1: Process pending addresses ──────────────────────────────────
    const pending = readQueue();

    if (pending.length > 0) {
        console.log(`[Sentry] Processing ${pending.length} addresses...`);

        const scanResults = await scanBatch(pending);
        const passed = scanResults.filter(r => r.passed).length;
        const failed = scanResults.length - passed;

        botsRejected += failed;
        console.log(`[Sentry] Scan: ✅ ${passed} passed | ❌ ${failed} rejected`);

        if (passed > 0) {
            const { attested, rejected, errors } = await attestBatch(scanResults);
            humansVerified += attested.length;
            console.log(
                `[Attestation] ✅ Attested: ${attested.length} | ` +
                `❌ Rejected: ${rejected.length} | ⚠️  Errors: ${errors.length}`
            );
        }

        clearQueue();
    } else {
        console.log("[Sentry] Queue empty — no new addresses");
    }

    // ── Step 2: Check milestone threshold ──────────────────────────────────
    if (process.env.IDENTITY_REGISTRY_ADDRESS) {
        try {
            const count = await getVerifiedCount();
            console.log(`[Sentry] Verified: ${count} / ${VERIFIED_THRESHOLD}`);


            // ...existing code...

            if (count >= VERIFIED_THRESHOLD) {
                console.log("");
                console.log("╔══════════════════════════════════════╗");
                console.log("║   🎯 MILESTONE THRESHOLD REACHED!    ║");
                console.log("╚══════════════════════════════════════╝");

                if (deployedUSDC > 0n) {
                    await returnFromYield(deployedUSDC);
                    deployedUSDC = 0n;
                }

                if (dealState !== "MILESTONE_COMPLETE") {
                    try {
                        // For POC: simulate tranche release
                        // In production: call escrow.releaseTranche() after state validation
                        console.log("[Sentry] 💰 Simulating tranche release...");

                        // Log what would happen
                        console.log(`[Sentry] ✅ Tranche released (simulated)`);
                        console.log(`[Sentry]    → 50,000 USDC released to beneficiary`);
                        console.log(`[Sentry]    → Deal completed successfully`);

                        dealState = "MILESTONE_COMPLETE";
                    } catch (err) {
                        console.error(`[Sentry] ❌ Release failed: ${err.message}`);
                        dealState = "MILESTONE_PENDING_RELEASE";
                    }
                }
            }


            // ...existing code...








        } catch (err) {
            console.error("[Sentry] Registry read error:", err.message);
        }
    } else {
        console.log("[Sentry] Waiting for IDENTITY_REGISTRY_ADDRESS...");
    }

    // ── Step 3: Yield management ───────────────────────────────────────────
    if (process.env.SENTINX_ESCROW_ADDRESS && deployedUSDC === 0n) {
        try {
            const escrow = getEscrow();
            if (escrow) {
                const idle = await escrow.getIdleBalance();
                const min = ethers.parseUnits("10", 6);

                if (idle > min) {
                    const amount = (idle * YIELD_RATIO) / 100n;
                    const result = await deployToYield(amount);
                    if (result) {
                        deployedUSDC = amount;
                        const { earnedUSD } = await estimateYield(deployedUSDC);
                        console.log(
                            `[Yield] 💰 ${ethers.formatUnits(amount, 6)} USDC deployed | ` +
                            `Yield earned so far: $${earnedUSD.toFixed(4)}`
                        );
                    }
                }
            }
        } catch (err) {
            console.error("[Yield] Error:", err.message);
        }
    } else if (!process.env.SENTINX_ESCROW_ADDRESS) {
        console.log("[Yield]  Waiting for SENTINX_ESCROW_ADDRESS...");
    }
}

// ── Express API ───────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Person C calls this to submit founder's user addresses
app.post("/submit", (req, res) => {
    const { addresses } = req.body;
    if (!Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: "addresses must be a non-empty array" });
    }

    const existing = readQueue();
    const combined = [...new Set([...existing, ...addresses])];
    writeFileSync(QUEUE_PATH, JSON.stringify(combined), "utf8");

    console.log(`[API] Queued ${addresses.length} addresses (total: ${combined.length})`);
    res.json({ queued: addresses.length, total: combined.length });
});

// Person C polls this to update the dashboard
app.get("/status", async (req, res) => {
    let verifiedCount = 0;
    let yieldEarned = 0;

    try {
        if (process.env.IDENTITY_REGISTRY_ADDRESS) {
            verifiedCount = await getVerifiedCount();
        }
        if (deployedUSDC > 0n) {
            const est = await estimateYield(deployedUSDC);
            yieldEarned = est.earnedUSD;
        }
    } catch { /* safe fallback */ }

    res.json({
        sentry_wallet: getSentryAddress(),
        verified_count: verifiedCount,
        threshold: VERIFIED_THRESHOLD,
        threshold_reached: verifiedCount >= VERIFIED_THRESHOLD,
        bots_rejected: botsRejected,
        humans_verified: humansVerified,
        deployed_usdc: ethers.formatUnits(deployedUSDC, 6),
        yield_earned_usd: yieldEarned.toFixed(4),
        deal_state: dealState,
        cycle_count: cycleCount,
        contracts_ready: !!process.env.SENTINX_ESCROW_ADDRESS,
    });
});

// ── Startup ───────────────────────────────────────────────────────────────
console.log("┌─────────────────────────────────────────────────┐");
console.log("│         SENTINX SENTRY AGENT v1.0               │");
console.log("├─────────────────────────────────────────────────┤");
console.log(`│ Sentry:   ${getSentryAddress()}  │`);
console.log(`│ Registry: ${process.env.IDENTITY_REGISTRY_ADDRESS || "⏳ waiting for Person A"}`);
console.log(`│ Escrow:   ${process.env.SENTINX_ESCROW_ADDRESS || "⏳ waiting for Person A"}`);
console.log(`│ USDC:     ${process.env.USDC_ADDRESS_XLAYER || "⏳ waiting for Person A"}`);
console.log(`│ Chain:    X Layer Testnet (195)                  │`);
console.log("└─────────────────────────────────────────────────┘");
console.log(`\n→ Sentry address: ${getSentryAddress()}\n`);

app.listen(3001, () => {
    console.log("[API] POST http://localhost:3001/submit");
    console.log("[API] GET  http://localhost:3001/status\n");
});

runCycle();
setInterval(runCycle, LOOP_MS);