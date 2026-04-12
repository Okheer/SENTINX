// agent/index.js
// SENTINX Sentry Agent — main autonomous loop.
// Polls for new founder submissions, scans them, attests approved ones,
// triggers milestone release when threshold is met.

import dotenv from "dotenv";
dotenv.config();

import { scanBatch } from "./services/diversity.js";
import { attestBatch, getVerifiedCount } from "./services/attestation.js";
import { deployToYield, returnFromYield, estimateYield } from "./services/yield.js";
import { ethers } from "ethers";

// ─── Config ────────────────────────────────────────────────────────────────
const LOOP_INTERVAL_MS = 30_000;   // poll every 30 seconds
const VERIFIED_THRESHOLD = 50;      // release tranche when 50 users verified
const YIELD_DEPLOY_RATIO = 0.80;    // deploy 80% of idle USDC to yield

// ─── Escrow interaction ────────────────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const sentryWallet = new ethers.Wallet(process.env.SENTRY_PRIVATE_KEY, provider);

const ESCROW_ABI = [
    "function releaseTranche() external",
    "function state() view returns (uint8)",
    "function getIdleBalance() view returns (uint256)",
    "function getVerifiedCount() view returns (uint256)",
];

function getEscrow() {
    return new ethers.Contract(
        process.env.SENTINX_ESCROW_ADDRESS, ESCROW_ABI, sentryWallet
    );
}

// ─── Queue of pending addresses ───────────────────────────────────────────
// In production: this comes from a smart contract event or an API.
// For Day 2 demo: load from a JSON file that Person C's frontend writes to.
let pendingAddresses = [];
let deployedUSDC = 0n;

/**
 * Load pending addresses from the shared queue.
 * Person C writes founder-submitted addresses to /tmp/pending_addresses.json
 * Person B reads and processes them here.
 */
async function loadPendingAddresses() {
    try {
        const { readFileSync, existsSync } = await import("fs");
        const path = "/tmp/pending_addresses.json";
        if (!existsSync(path)) return [];
        const raw = readFileSync(path, "utf8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Main processing cycle.
 */
async function runCycle() {
    console.log(`\n[Sentry] ════ New cycle at ${new Date().toISOString()} ════`);

    try {
        // ── 1. Load pending addresses ──────────────────────────────────────────
        const newAddresses = await loadPendingAddresses();
        if (newAddresses.length > 0) {
            console.log(`[Sentry] Processing ${newAddresses.length} new addresses...`);

            // ── 2. Diversity scan ──────────────────────────────────────────────
            const scanResults = await scanBatch(newAddresses);
            const passCount = scanResults.filter(r => r.passed).length;
            console.log(
                `[Sentry] Scan: ${passCount}/${scanResults.length} passed diversity check`
            );

            // ── 3. Attest passed users on-chain ───────────────────────────────
            if (passCount > 0) {
                const { attested, rejected, errors } = await attestBatch(scanResults);
                console.log(
                    `[Sentry] Attested: ${attested.length} | ` +
                    `Rejected: ${rejected.length} | Errors: ${errors.length}`
                );
            }

            // Clear the queue (in production: mark as processed in DB)
            const { writeFileSync } = await import("fs");
            writeFileSync("/tmp/pending_addresses.json", "[]", "utf8");
        }

        // ── 4. Check verified count → milestone trigger ────────────────────
        if (process.env.IDENTITY_REGISTRY_ADDRESS) {
            const verifiedCount = await getVerifiedCount();
            console.log(`[Sentry] Verified users on-chain: ${verifiedCount}`);

            if (verifiedCount >= VERIFIED_THRESHOLD) {
                console.log(`[Sentry] 🎯 Threshold reached! Triggering milestone release...`);

                // Pull capital back from yield before release
                if (deployedUSDC > 0n) {
                    await returnFromYield(deployedUSDC);
                    deployedUSDC = 0n;
                }

                const escrow = getEscrow();
                const tx = await escrow.releaseTranche();
                await tx.wait();
                console.log(`[Sentry] ✅ Milestone tranche released: ${tx.hash}`);
            }
        }

        // ── 5. Yield management: deploy idle capital ───────────────────────
        if (process.env.SENTINX_ESCROW_ADDRESS && deployedUSDC === 0n) {
            try {
                const escrow = getEscrow();
                const idleBalance = await escrow.getIdleBalance();

                if (idleBalance > ethers.parseUnits("10", 6)) { // min 10 USDC to deploy
                    const deployAmount = (idleBalance * BigInt(Math.floor(YIELD_DEPLOY_RATIO * 100))) / 100n;
                    await deployToYield(deployAmount);
                    deployedUSDC = deployAmount;

                    // Estimate yield earned so far
                    const { earnedUSD, yieldPct } = await estimateYield(deployedUSDC);
                    console.log(
                        `[Sentry] 💰 Yield: $${earnedUSD.toFixed(4)} earned (${yieldPct.toFixed(4)}%)`
                    );
                }
            } catch (err) {
                // Yield errors should not crash the main loop
                console.error("[Sentry] Yield management error:", err.message);
            }
        }

    } catch (err) {
        console.error("[Sentry] Cycle error:", err.message);
    }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════╗");
console.log("║     SENTINX Sentry Agent v1.0        ║");
console.log("╚══════════════════════════════════════╝");

// Print sentry address for Person A to whitelist
const { getSentryAddress } = await import("./services/attestation.js");
console.log(`[Sentry] Wallet address: ${getSentryAddress()}`);
console.log(`[Sentry] → Give this address to Person A for contract whitelisting!`);
console.log(`[Sentry] Loop interval: ${LOOP_INTERVAL_MS / 1000}s`);
console.log(`[Sentry] Milestone threshold: ${VERIFIED_THRESHOLD} verified users`);
console.log(`[Sentry] Starting...\n`);

runCycle();
setInterval(runCycle, LOOP_INTERVAL_MS);