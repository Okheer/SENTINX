
// SENTINX Sentry Agent — main autonomous loop.
// Polls for new founder submissions, scans them, attests approved ones,
// triggers milestone release when threshold is met.

import dotenv from "dotenv";
dotenv.config();

import { scanBatch } from "./services/diversity.js";
import { attestBatch, getVerifiedCount } from "./services/attestation.js";
import { deployToYield } from "./services/yieldHunter.js";
import { runDecisionEngineCycle } from "./services/decision-engine.js";
import { ethers } from "ethers";

const LOOP_INTERVAL_MS = 30_000;   // poll every 30 seconds
const VERIFIED_THRESHOLD = 2;       // release tranche when 2 users verified (DEMO MODE)


const OKB_INVESTMENT_ID = 33913;     // OKB DeFi product on X Layer
const INVESTMENT_TOKEN = "OKB";      // Token to invest
const MIN_BALANCE_ETH = "0.01";      // Minimum balance to trigger investment (in ETH units)
const INVESTMENT_AMOUNT = "0.01";    // Amount to invest (in human-readable form)

let _provider = null;
let _sentryWallet = null;

function getProvider() {
    if (!_provider) {
        const rpcUrl = process.env.RPC_URL || "https://testrpc.xlayer.tech";
        _provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return _provider;
}

function getSentryWallet() {
    if (!_sentryWallet) {
        if (!process.env.SENTRY_PRIVATE_KEY) {
            throw new Error("SENTRY_PRIVATE_KEY not set in .env");
        }
        _sentryWallet = new ethers.Wallet(process.env.SENTRY_PRIVATE_KEY, getProvider());
    }
    return _sentryWallet;
}

const ESCROW_ABI = [
    "function approveMilestone(uint256 milestoneId) external",
    "function getEscrowState(uint256 escrowId) view returns (uint8)",
    "function getEscrowGrants(uint256 escrowId) view returns (address grantToken, uint256 grantTotal, uint256 grantReleased, address equityToken, uint256 equityTotal, uint256 equityReleased)",
    "function getVerifiedCount() view returns (uint256)", 
];

function getEscrow() {
    return new ethers.Contract(
        process.env.SENTINX_ESCROW_ADDRESS, ESCROW_ABI, getSentryWallet()
    );
}

// ─── Queue of pending addresses ───────────────────────────────────────────
// In production: this comes from a smart contract event or an API.
// For Day 2 demo: load from a JSON file that Person C's frontend writes to.
let pendingAddresses = [];
let isDeploying = false;  // State lock to prevent duplicate yield deployments

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
            
            // Extract ONLY the ones that passed
            const passedOnes = scanResults.filter(r => r.passed);
            
            console.log(
                `[Sentry] Scan: ${passedOnes.length}/${scanResults.length} passed diversity check.`
            );

            // ── 3. Attest passed users on-chain ───────────────────────────────
            if (passedOnes.length > 0) {
                console.log(`[Sentry] Attesting ${passedOnes.length} verified users...`);
              
                const { attested, rejected, errors } = await attestBatch(passedOnes);
              
                console.log(
                    `[Sentry] Attested: ${attested?.length || 0} | ` +
                    `Rejected: ${rejected?.length || 0} | Errors: ${errors?.length || 0}`
                );
            }

            const { writeFileSync } = await import("fs");
            writeFileSync("/tmp/pending_addresses.json", "[]", "utf8");
        }

        // ── 4. Check verified count → milestone trigger 
        if (process.env.IDENTITY_REGISTRY_ADDRESS) {
            const verifiedCount = await getVerifiedCount();
            console.log(`[Sentry] Verified users on-chain: ${verifiedCount}`);

            if (verifiedCount >= VERIFIED_THRESHOLD) {
                console.log(`[Sentry] Threshold reached! Triggering milestone approval...`);

                const escrow = getEscrow();
                // NECESSARY CHANGE: Calling approveMilestone(1) instead of releaseTranche()
                const tx = await escrow.approveMilestone(1); 
                await tx.wait();
                console.log(`[Sentry] ✅ Milestone 1 Approved! Founder can now claim funds. Hash: ${tx.hash}`);
            }
        }

        // ── 4.5. DECISION ENGINE: Run autonomous yield/milestone operations ───
        // This replaces the old yield management logic with the new decision engine
        if (process.env.MOCK_ROUTER_ADDRESS) {
            console.log("[Sentry] Running Decision Engine cycle...");
            try {
                await runDecisionEngineCycle();
            } catch (err) {
                console.error("[Sentry] Decision Engine error:", err.message);
            }
        }

        // ── 5. Yield management: deploy idle capital to DeFi
        if (process.env.SENTINX_ESCROW_ADDRESS && !isDeploying) {
            try {
                // Check for native token balance (not USDC)
                const nativeBalance = await getProvider().getBalance(getSentryWallet().address);
                const minBalance = ethers.parseEther(MIN_BALANCE_ETH);

                console.log(
                    `[Sentry] 💰 Native token balance: ${ethers.formatEther(nativeBalance)} ETH`
                );

                if (nativeBalance >= minBalance) {
                    console.log(
                        `[Sentry] 🎯 Balance threshold reached! ` +
                        `Deploying ${INVESTMENT_AMOUNT} ${INVESTMENT_TOKEN} to DeFi...`
                    );

                    isDeploying = true;

                    try {
                        const success = await deployToYield(
                            INVESTMENT_AMOUNT,
                            OKB_INVESTMENT_ID,
                            INVESTMENT_TOKEN,
                            getSentryWallet().address
                        );

                        if (success) {
                            console.log(
                                `[Sentry] ✅ DeFi investment successful!`
                            );
                        } else {
                            console.error("[Sentry] DeFi investment failed - see logs above for details");
                        }
                    } finally {
    
                        isDeploying = false;
                    }
                }
            } catch (err) {
                // Yield errors should not crash the main loop
                console.error("[Sentry] Yield management error:", err.message);
                isDeploying = false;
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