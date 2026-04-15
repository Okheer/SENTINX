// agent/index.js
// SENTINX Sentry Agent — main autonomous loop.
// Fully integrated with Frontend Bridge and Decision Engine.

import dotenv from "dotenv";
dotenv.config();

import { scanBatch } from "./services/diversity.js";
import { attestBatch, getVerifiedCount, getSentryAddress } from "./services/attestation.js";
import { runDecisionEngineCycle } from "./services/decision-engine.js";
import { ethers } from "ethers";
import './server.js'; // Starts the API server
import { agentState } from './server.js';

// ─── Console Hijack for Web Terminal ──────────────────────────────────────
const originalLog = console.log;
console.log = (...args) => {
    originalLog(...args); 
    const message = args.join(' ');
    
    agentState.logs.push({
        time: new Date().toLocaleTimeString(),
        msg: message,
        type: message.includes('✅') ? 'success' : (message.includes('❌') ? 'error' : 'info')
    });

    if (agentState.logs.length > 50) agentState.logs.shift();
};

const LOOP_INTERVAL_MS = 30_000;   
const VERIFIED_THRESHOLD = 2;       

let _provider = null;

function getProvider() {
    if (!_provider) {
        const rpcUrl = process.env.RPC_URL || "https://testrpc.xlayer.tech";
        _provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return _provider;
}

// ─── Shared Queue Logic ───────────────────────────────────────────────────
async function loadPendingAddresses() {
    let addresses = [];
    // 1. Check for addresses submitted via the Web Dashboard (API)
    if (agentState.pending_addresses && agentState.pending_addresses.length > 0) {
        addresses = [...agentState.pending_addresses];
        agentState.pending_addresses = []; // Clear queue after picking up
    }

    // 2. Check for addresses submitted via the legacy JSON file
    try {
        const { readFileSync, existsSync, writeFileSync } = await import("fs");
        const path = "/tmp/pending_addresses.json";
        if (existsSync(path)) {
            const raw = readFileSync(path, "utf8");
            const fileAddresses = JSON.parse(raw);
            if (fileAddresses.length > 0) {
                addresses = [...addresses, ...fileAddresses];
                writeFileSync(path, "[]", "utf8"); // Clear file
            }
        }
    } catch (e) { /* ignore file errors */ }
    
    return [...new Set(addresses)]; // Return unique addresses
}

/**
 * Main processing cycle.
 */
async function runCycle() {
    console.log(`\n[Sentry] ════ New cycle at ${new Date().toISOString()} ════`);
    agentState.cycle_count++;

    try {
        // ── 1. Load pending addresses (From Web or File) ──────────────────────
        const newAddresses = await loadPendingAddresses();
        
        if (newAddresses.length > 0) {
            console.log(`[Sentry] 🔍 Processing ${newAddresses.length} new addresses...`);
            agentState.deal_state = 'VERIFYING';

            // ── 2. Diversity scan ──────────────────────────────────────────────
            const scanResults = await scanBatch(newAddresses);
            const passedOnes = scanResults.filter(r => r.passed);
            
            agentState.bots_rejected += (scanResults.length - passedOnes.length);
            console.log(`[Sentry] Scan: ${passedOnes.length}/${scanResults.length} passed diversity check.`);

            // ── 3. Attest passed users on-chain via TEE ────────────────────────
            if (passedOnes.length > 0) {
                console.log(`[Sentry] ✍️ Attesting ${passedOnes.length} verified users via TEE...`);
              
                const { attested, rejected, errors } = await attestBatch(passedOnes);
              
                console.log(
                    `[Sentry] ✅ Attested: ${attested?.length || 0} | ` +
                    `Rejected: ${rejected?.length || 0} | Errors: ${errors?.length || 0}`
                );
            }
        }

        // ── 4. Check verified count & Update UI ──────────────────────────────
        const verifiedCount = await getVerifiedCount();
        agentState.verified_count = verifiedCount;
        agentState.humans_verified = verifiedCount;
        console.log(`[Sentry] Verified users on-chain: ${verifiedCount}`);

        if (verifiedCount >= VERIFIED_THRESHOLD) {
            agentState.threshold_reached = true;
            console.log(`[Sentry] 🎯 Threshold reached! Triggering milestone approval...`);
            
            // Note: The Decision Engine or runCycle handles the actual Escrow call
            // We update state here so the UI shows the "Success" state
            agentState.deal_state = 'SUCCESS';
        }

        // ── 5. DECISION ENGINE: Run autonomous yield/milestone operations ───
       // ── 5. DECISION ENGINE: Run autonomous yield/milestone operations ───
        if (process.env.MOCK_ROUTER_ADDRESS) {
            console.log("[Sentry] Running Decision Engine cycle...");
            try {
                await runDecisionEngineCycle();
                
                // ✅ FIX: Only update from the contract if it's actually greater than 0.
                // Otherwise, leave the manual UI deposit alone!
                if (agentState.grantLocked > 0) {
                    agentState.deployed_usdc = agentState.grantLocked.toFixed(2);
                }
                
            } catch (err) {
                console.error("[Sentry] ❌ Decision Engine error:", err.message);
            }
        }

        // ── 6. Update Native Balance for Dashboard ───────────────────────────
        const sentryAddr = getSentryAddress();
        const nativeBalance = await getProvider().getBalance(sentryAddr);
        console.log(`[Sentry] 💰 Native token balance: ${ethers.formatEther(nativeBalance)} ETH`);

    } catch (err) {
        console.error("[Sentry] ❌ Cycle error:", err.message);
    }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════╗");
console.log("║     SENTINX Sentry Agent v1.0        ║");
console.log("╚══════════════════════════════════════╝");

const sentryAddr = getSentryAddress();
agentState.sentry_wallet = sentryAddr;
agentState.contracts_ready = !!process.env.SENTINX_ESCROW_ADDRESS;

console.log(`[Sentry] Wallet address: ${sentryAddr}`);
console.log(`[Sentry] → Give this address to Person A for contract whitelisting!`);
console.log(`[Sentry] Loop interval: ${LOOP_INTERVAL_MS / 1000}s`);
console.log(`[Sentry] Milestone threshold: ${VERIFIED_THRESHOLD} verified users`);
console.log(`[Sentry] Starting...\n`);

// Run immediately then start interval
runCycle();
setInterval(runCycle, LOOP_INTERVAL_MS);