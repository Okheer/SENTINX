// simulate-vc.js
// Simulates a Venture Capitalist funding the SentinX Escrow contract.

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function runVCFunding() {
    console.log("╔══════════════════════════════════════╗");
    console.log("║     VC Simulation: Funding Escrow    ║");
    console.log("╚══════════════════════════════════════╝\n");

    // 1. Setup Provider and VC Wallet
    const rpcUrl = process.env.RPC_URL || "https://testrpc.xlayer.tech";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // NOTE: You need a VC_PRIVATE_KEY in your .env that has some native gas tokens AND the mock USDC.
    if (!process.env.VC_PRIVATE_KEY) throw new Error("Missing VC_PRIVATE_KEY in .env");
    const vcWallet = new ethers.Wallet(process.env.VC_PRIVATE_KEY, provider);

    // 2. Configuration Variables
    const escrowAddress = process.env.SENTINX_ESCROW_ADDRESS;
    const usdcAddress = process.env.USDC_ADDRESS; // Add your testnet USDC address to .env
    const founderAddress = "0x94f94a111cBBd5e33ec440A199542955a307bB8e"; // The payee receiving the grant
    const depositAmountString = "100"; // $100 USDC

    if (!escrowAddress || !usdcAddress) {
        throw new Error("Missing SENTINX_ESCROW_ADDRESS or USDC_ADDRESS in .env");
    }

    console.log(`[VC] Wallet: ${vcWallet.address}`);
    console.log(`[VC] Escrow: ${escrowAddress}`);
    console.log(`[VC] USDC:   ${usdcAddress}\n`);

    // 3. Contract ABIs
    const ERC20_ABI = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address account) view returns (uint256)"
    ];

    const ESCROW_ABI = [
        "function createEscrow(address payee, address grantToken, uint256 grantAmount) external returns (uint256)"
    ];

    const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, vcWallet);
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, vcWallet);

    try {
        // 4. Format the amount based on USDC decimals
        const decimals = await usdc.decimals();
        const depositAmount = ethers.parseUnits(depositAmountString, decimals);

        // Check VC balance first
        const balance = await usdc.balanceOf(vcWallet.address);
        if (balance < depositAmount) {
            throw new Error(`Insufficient USDC! Wallet has ${ethers.formatUnits(balance, decimals)}, needs ${depositAmountString}`);
        }

        // 5. Approve the Escrow to pull the USDC
        console.log(`[VC] ⏳ Approving Escrow to spend ${depositAmountString} USDC...`);
        const approveTx = await usdc.approve(escrowAddress, depositAmount);
        await approveTx.wait();
        console.log(`[VC] ✅ Approval successful! Hash: ${approveTx.hash}`);

        // 6. Call createEscrow
        console.log(`[VC] ⏳ Calling createEscrow for Founder (${founderAddress})...`);
        const createTx = await escrow.createEscrow(founderAddress, usdcAddress, depositAmount);
        const receipt = await createTx.wait();
        console.log(`[VC] ✅ Escrow #1 Created Successfully! Hash: ${receipt.hash}`);
        
        console.log(`\n[VC] 🎉 Funding complete! Check your Sentry Agent terminal; it should detect this within 30 seconds.`);

    } catch (error) {
        console.error(`\n[VC] ❌ Simulation Failed:`, error.message);
    }
}

runVCFunding();