import { exec } from 'child_process';
import util from 'util';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = util.promisify(exec);

export async function findBestUSDCYield() {
    console.log("🔍 Sentry is hunting for the best USDC yield on X Layer...");

    try {
        // 1. Search for USDC products in the DEX_POOL and LENDING groups
        const command = `onchainos defi search --token USDC --chain xlayer --product-group DEX_POOL`;
        const { stdout, stderr } = await execAsync(command);

        if (stderr) console.warn("[YieldHunter] CLI Warning:", stderr);

        const products = JSON.parse(stdout);

        if (!products || products.length === 0) {
            throw new Error("No yield products found for USDC on X Layer.");
        }

        // 2. Sort by rate (APY) descending
        // Note: 'rate' is returned as a decimal (e.g., 0.05 for 5%)
        const sortedProducts = products.sort((a, b) => b.rate - a.rate);

        // 3. Select the winner (with a basic TVL safety check)
        // We want high APY, but we need at least $100k TVL to avoid massive slippage
        const bestPool = sortedProducts.find(p => parseFloat(p.tvl.replace(/[^0-9.]/g, '')) > 100000) || sortedProducts[0];

        const apyPercentage = (bestPool.rate * 100).toFixed(2);
        
        console.log(`🏆 Best Opportunity Found!`);
        console.log(`📍 Platform: ${bestPool.platformName}`);
        console.log(`📈 APY: ${apyPercentage}%`);
        console.log(`💰 TVL: ${bestPool.tvl}`);
        console.log(`🆔 ID: ${bestPool.investmentId}`);

        // 4. Safety Guardrail
        if (bestPool.rate > 0.5) {
            console.warn("⚠️ WARNING: Extremely high APY detected (>50%). This may be high risk.");
        }

        return {
            investmentId: bestPool.investmentId,
            platform: bestPool.platformName,
            apy: apyPercentage,
            tokenAddress: bestPool.underlyingToken[0]?.tokenAddress
        };

    } catch (error) {
        console.error("❌ Yield Hunt Failed:", error.message);
        return null;
    }
}

/**
 * deployToYield - Execute DeFi investment via OKX CLI
 * * @param {string} amount - Human-readable amount (e.g., "0.01")
 * @param {number} investmentId - DeFi product investment ID
 * @param {string} token - Token symbol (e.g., "OKB", "USDC")
 * @param {string} walletAddress - User's wallet address
 * @returns {boolean} true on success, false on error
 */
export async function deployToYield(amount, investmentId, token, walletAddress) {
    console.log(`\n💼 [YieldHunter] Deploying ${amount} ${token} to Aave (Pool #${investmentId})...`);

    try {
        const privateKey = process.env.SENTRY_PRIVATE_KEY || process.env.PRIVATE_KEY;
        const rpcUrl = process.env.RPC_URL || "https://testrpc.xlayer.tech";

        if (!privateKey) throw new Error("Missing PRIVATE_KEY in .env");

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);

        // 1. Convert human readable (0.01) to minimal units (Wei)
        const minimalUnits = ethers.parseUnits(amount.toString(), 18).toString();

        // 2. Call OKX CLI 
        const command = `onchainos defi invest --investment-id ${investmentId} --address ${walletAddress} --token ${token} --amount ${minimalUnits} --chain xlayer`;
        
        console.log(`🔗 Querying OKX Aggregator CLI...`);
        const { stdout, stderr } = await execAsync(command);

        if (stderr) console.warn("⚠️ CLI Warning:", stderr);

        // 3. Parse the OKX specific JSON structure
        const response = JSON.parse(stdout);
        
        if (!response.ok || !response.data?.dataList?.length) {
            throw new Error("CLI failed to build transaction: " + (response.error || "Unknown error"));
        }

        // CORRECT JSON EXTRACTION
        const txData = response.data.dataList[0];

        // 4. Sign and broadcast via Ethers.js
        console.log(`✍️ [YieldHunter] Blueprint received. Signing transaction...`);
        const tx = await wallet.sendTransaction({
            to: txData.to,
            data: txData.serializedData, // OKX uses serializedData, not data
            value: txData.value || "0"
        });

        console.log(`🚀 [YieldHunter] Transaction broadcasted!`);
        console.log(`🔗 Explorer: https://www.okx.com/web3/explorer/xlayer-test/tx/${tx.hash}`);

        // 5. Wait for confirmation
        console.log("⏳ Waiting for network confirmation...");
        const receipt = await tx.wait();
        console.log(`✅ [YieldHunter] SUCCESS! Confirmed in block ${receipt.blockNumber}.`);

        return true;

    } catch (error) {
        console.error("❌ [YieldHunter] DeFi Investment Failed:", error.message);
        return false;
    }
}