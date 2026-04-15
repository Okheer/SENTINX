// agent/services/decision-engine.js
// X-Sentry Treasury Decision Engine - AGENTIC WALLET VERSION (TEE)

import { exec } from 'child_process';
import util from 'util';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = util.promisify(exec);

// ─── Config ────────────────────────────────────────────────────────────────
const YIELD_TRIGGER_THRESHOLD = 100;
const MILESTONE_TRIGGER = 50;         
const WETH_SYMBOL = "WETH";           
const USDC_SYMBOL = "USDC";           
const OKX_SWAP_TIMEOUT = 30000;       

// ─── Lazy Provider (Read-Only) ─────────────────────────────────────────────
let _provider = null;

function getProvider() {
    if (!_provider) {
        const rpcUrl = process.env.RPC_URL || "https://testrpc.xlayer.tech";
        _provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return _provider;
}

function getSentryAddress() {
    if (!process.env.SENTRY_ADDRESS) {
        throw new Error("SENTRY_ADDRESS not set in .env");
    }
    return process.env.SENTRY_ADDRESS;
}

// ─── Contract ABIs ────────────────────────────────────────────────────────

const ESCROW_ABI = [
    "function getEscrowState(uint256 escrowId) view returns (uint8)",
    "function getEscrowGrants(uint256 escrowId) view returns (address grantToken, uint256 grantTotal, uint256 grantReleased, address equityToken, uint256 equityTotal, uint256 equityReleased)",
    "function executeAgentAction(address target, uint256 value, bytes data)",
    "function approveMilestone(uint256 milestoneId)"
];

const REGISTRY_ABI = [
    "function isRegistered(address user) view returns (bool)",
];

// ─── Helper: Get Read-Only Contract Instances ──────────────────────────────

function getEscrowReadOnly() {
    if (!process.env.SENTINX_ESCROW_ADDRESS) {
        throw new Error("SENTINX_ESCROW_ADDRESS not set in .env");
    }
    // Notice we pass getProvider() instead of a Wallet. This makes it read-only.
    return new ethers.Contract(
        process.env.SENTINX_ESCROW_ADDRESS,
        ESCROW_ABI,
        getProvider() 
    );
}

function getRegistryReadOnly() {
    if (!process.env.IDENTITY_REGISTRY_ADDRESS) {
        throw new Error("IDENTITY_REGISTRY_ADDRESS not set in .env");
    }
    return new ethers.Contract(
        process.env.IDENTITY_REGISTRY_ADDRESS,
        REGISTRY_ABI,
        getProvider()
    );
}

// ─── Operational Protocol: Phase 1 ────────────────────────────────────────
export async function executePhase1_Deployment() {
    console.log("\n[Decision Engine] ─── PHASE 1: DEPLOYMENT ───");

    try {
        const escrow = getEscrowReadOnly();
        
        let idleBalance = 0;
        let rawBalanceString = "0"; 
        try {
            const grants = await escrow.getEscrowGrants(1);
            const grantTokenAddress = grants.grantToken;

            const tokenContract = new ethers.Contract(
                grantTokenAddress, 
                ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], 
                getProvider()
            );
            
            const rawBalance = await tokenContract.balanceOf(process.env.SENTINX_ESCROW_ADDRESS);
            rawBalanceString = rawBalance.toString();
            const decimals = await tokenContract.decimals();
            idleBalance = parseFloat(ethers.formatUnits(rawBalance, decimals));

        } catch (err) {
            console.log(`[Decision Engine] ⚠️ Could not fetch idle balance: ${err.message}`);
            return false;
        }

        console.log(`[Decision Engine] Idle balance: $${idleBalance.toFixed(2)} USDC`);

        if (idleBalance < YIELD_TRIGGER_THRESHOLD) {
            console.log(`[Decision Engine] ✓ Balance below threshold. Skipping deployment.`);
            return false;
        }

        console.log(`[Decision Engine] 🎯 Threshold reached! Deploying ${idleBalance} USDC to yield...`);

        // Step 1: Get swap calldata
        console.log(`[Decision Engine] 📞 Calling OKX CLI for swap calldata...`);
        const swapCmd = `onchainos swap swap --from ${USDC_SYMBOL} --to ${WETH_SYMBOL} --amount ${rawBalanceString} --chain xlayer --wallet ${getSentryAddress()}`;
        
        let swapOutput;
        try {
            const { stdout } = await Promise.race([
                execAsync(swapCmd),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("OKX swap call timeout")), OKX_SWAP_TIMEOUT)
                )
            ]);
            swapOutput = JSON.parse(stdout);
        } catch (err) {
            console.error(`[Decision Engine] ❌ OKX CLI error: ${err.message}`);
            return false;
        }

        if (!swapOutput.data || swapOutput.data.length === 0) return false;

        const txPayload = swapOutput.data[0].tx || swapOutput.data[0];
        const calldata = txPayload.data || txPayload.serializedData;

        console.log(`[Decision Engine] ✅ Received calldata`);
        console.log(`[Decision Engine] ✍️ Executing agent action via OnchainOS CLI (TEE)...`);

        const mockRouterAddr = process.env.MOCK_ROUTER_ADDRESS;
        
        // Step 2: Write to Blockchain via CLI instead of Ethers
        console.log(`[Decision Engine] ✍️ Encoding transaction data locally...`);
        
        // Use ethers to encode the function call into raw hex data
        const escrowInterface = new ethers.Interface(ESCROW_ABI);
        const encodedInputData = escrowInterface.encodeFunctionData("executeAgentAction", [
            mockRouterAddr,
            0,
            calldata
        ]);

        // Pass the encoded data to the correct CLI command
        const executeCmd = `onchainos wallet contract-call --to ${process.env.SENTINX_ESCROW_ADDRESS} --chain xlayer --input-data ${encodedInputData}`;
        
        const { stdout: execOut } = await execAsync(executeCmd);
        console.log(`[Decision Engine] ✅ PHASE 1 SUCCESS via TEE! CLI Output: ${execOut.substring(0, 100)}...`);

        return true;

    } catch (err) {
        console.error(`[Decision Engine] ❌ Phase 1 failed: ${err.message}`);
        return false;
    }
}

// ─── Operational Protocol: Phase 2 ────────────────────────────────────────
export async function executePhase2_MilestoneVerification() {
    console.log("\n[Decision Engine] ─── PHASE 2: MILESTONE VERIFICATION ───");

    try {
        const registry = getRegistryReadOnly();

        const targetUser1 = "0x94f94a111cBBd5e33ec440A199542955a307bB8e";  
        const targetUser2 = "0x7338FA942f343A305fE42c357E8Ae671eF1358e1"; 

        let isUser1Verified = false;
        let isUser2Verified = false;

        try {
            isUser1Verified = await registry.isRegistered(targetUser1);
            isUser2Verified = await registry.isRegistered(targetUser2);
        } catch (err) {
            console.log("[Decision Engine] ⚠️ Could not check registration status");
            return false;
        }

        console.log(`[Decision Engine] User 1 Verified: ${isUser1Verified}`);
        console.log(`[Decision Engine] User 2 Verified: ${isUser2Verified}`);

        if (!isUser1Verified || !isUser2Verified) {
            console.log(`[Decision Engine] ✓ Milestone targets not met yet. Skipping milestone release.`);
            return false; 
        }

        console.log(`[Decision Engine] 🎯 MILESTONE TRIGGERED! Unwinding yield...`);

        // Step A: Swap WETH back to USDC via CLI
        const unwindAmount = "0.001"; 
        const unwindAmountRaw = ethers.parseUnits(unwindAmount, 18).toString(); 
        const unwindCmd = `onchainos swap swap --from ${WETH_SYMBOL} --to ${USDC_SYMBOL} --amount ${unwindAmountRaw} --chain xlayer --wallet ${getSentryAddress()}`;

        let unwindOutput;
        try {
            const { stdout } = await Promise.race([
                execAsync(unwindCmd),
                new Promise((_, reject) => setTimeout(() => reject(new Error("OKX unwind call timeout")), OKX_SWAP_TIMEOUT))
            ]);
            unwindOutput = JSON.parse(stdout);
        } catch (err) {
            return false;
        }

        const unwindPayload = unwindOutput.data[0].tx || unwindOutput.data[0];
        const unwindCalldata = unwindPayload.data || unwindPayload.serializedData;

        console.log(`[Decision Engine] ✍️ Executing unwind via OnchainOS CLI (TEE)...`);
        const mockRouterAddr = process.env.MOCK_ROUTER_ADDRESS;
        
        // Use ethers to encode the function call into raw hex data
        const escrowInterface = new ethers.Interface(ESCROW_ABI);
        const encodedUnwindData = escrowInterface.encodeFunctionData("executeAgentAction", [
            mockRouterAddr,
            0,
            unwindCalldata
        ]);
        
        const unwindExecCmd = `onchainos wallet contract-call --to ${process.env.SENTINX_ESCROW_ADDRESS} --chain xlayer --input-data ${encodedUnwindData}`;
        await execAsync(unwindExecCmd);

        // Step B: Approve milestone via CLI
        console.log(`[Decision Engine] 💰 Approving Milestone 1 for Founder via TEE...`);
        const encodedApproveData = escrowInterface.encodeFunctionData("approveMilestone", [1]);
        
        const approveCmd = `onchainos wallet contract-call --to ${process.env.SENTINX_ESCROW_ADDRESS} --chain xlayer --input-data ${encodedApproveData}`;
        await execAsync(approveCmd);

        console.log(`[Decision Engine] ✅ PHASE 2 SUCCESS! 🎉 Founder can now claim their payment!`);

        return true;

    } catch (err) {
        console.error(`[Decision Engine] ❌ Phase 2 failed: ${err.message}`);
        return false;
    }
}

// ─── Main watcher loop ──────────────────────────────────────────────────────

let isPhase1Active = false;
let isPhase2Active = false;

export async function runDecisionEngineCycle() {
    console.log(`\n[Decision Engine] New cycle at ${new Date().toISOString()}`);

    if (!isPhase1Active) {
        isPhase1Active = true;
        try {
            await executePhase1_Deployment();
        } finally {
            isPhase1Active = false;
        }
    }

    if (!isPhase2Active) {
        isPhase2Active = true;
        try {
            await executePhase2_MilestoneVerification();
        } finally {
            isPhase2Active = false;
        }
    }
}

export async function startDecisionEngine(intervalMs = 30000) {
    console.log("╔══════════════════════════════════════╗");
    console.log("║  X-Sentry Agentic Engine (TEE) v2.0  ║");
    console.log("╚══════════════════════════════════════╝");
    console.log(`[Decision Engine] Agent: ${getSentryAddress()}`);
    console.log(`[Decision Engine] Escrow: ${process.env.SENTINX_ESCROW_ADDRESS}`);
    console.log(`[Decision Engine] Loop interval: ${intervalMs / 1000}s`);
    console.log(`[Decision Engine] Starting autonomous mode...\n`);

    runDecisionEngineCycle();
    setInterval(runDecisionEngineCycle, intervalMs);
}