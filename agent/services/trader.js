import 'dotenv/config';
import { ethers } from 'ethers';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

async function executeTrade() {
    console.log("🤖 Agent Trading Module Initialized...");

    // 1. Setup the Guardian Wallet
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`🏦 Guardian Wallet Connected: ${wallet.address}`);

    try {
        console.log("📊 Asking Onchain OS to generate swap calldata...");
        
        // 2. Call the Onchain OS CLI for "Calldata Only"
        const command = `onchainos swap swap --from 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee --to USDC --readable-amount 1 --chain xlayer --wallet ${wallet.address}`;
        
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr) {
            console.error("OS Warning:", stderr);
        }

        // Parse the JSON output from the CLI
        const tradeData = JSON.parse(stdout);
        console.log("✅ Route found! Here is the raw payload:");
        
        // Let's print exactly what OKX sent back so we can see the structure!
        console.log(JSON.stringify(tradeData, null, 2));

        // Safely extract the transaction payload 
        // OKX usually wraps the response in tradeData.data[0].tx or tradeData.data[0]
        const txPayload = tradeData.data[0].tx || tradeData.data[0];

        // 3. Sign and Broadcast via Ethers.js
        console.log("✍️ Guardian is signing the trade...");
        const tx = await wallet.sendTransaction({
            to: txPayload.to,
            data: txPayload.data,
            value: txPayload.value || "0"
        });

        console.log(`🚀 Trade Executed! TX Hash: ${tx.hash}`);

    } catch (error) {
        console.error("❌ Trade Failed. Error:", error.message);
    }
}

executeTrade();