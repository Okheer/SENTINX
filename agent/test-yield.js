import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);

// --- ALIGNED SETTINGS ---
const TARGET_TOKEN = "OKB";
const TARGET_CHAIN = "xlayer";
const POOL_ID = "33913"; // Matches your index.js

async function testYieldHunter() {
    console.log("\n--- 🏹 SENTRY YIELD HUNTER TEST START ---");
    
    try {
        console.log(`📡 Querying OKX CLI to check pool ${POOL_ID} for ${TARGET_TOKEN}...`);
        
        // This is a safer command to test if the CLI is responding properly
        const command = `onchainos defi search --token ${TARGET_TOKEN} --chain ${TARGET_CHAIN}`;
        
        let stdout, stderr;
        try {
            const result = await execAsync(command);
            stdout = result.stdout;
            stderr = result.stderr;
        } catch (cliError) {
            console.error("❌ CLI Execution Failed:", cliError.message);
            return;
        }

        // SAFE PARSING: Catch the error if the CLI spits out plain text instead of JSON
        let response;
        try {
            response = JSON.parse(stdout);
        } catch (parseError) {
            console.error("❌ Could not parse CLI output as JSON. CLI returned:");
            console.log(stdout || stderr);
            return;
        }

        const products = response.data || response.result || (Array.isArray(response) ? response : []);

        if (!products || products.length === 0) {
            console.log("⚠️ Found 0 products. Ensure your OKX CLI is configured correctly.");
            return;
        }

        // See if your specific pool exists in the search results
        const myPool = products.find(p => p.investmentId === POOL_ID || p.id === POOL_ID);

        if (myPool) {
            console.log(`✅ FOUND YOUR POOL!`);
            console.log(`🥇 Platform:  ${myPool.platformName}`);
            console.log(`📈 APY:       ${((parseFloat(myPool.rate) || 0) * 100).toFixed(2)}%`);
            console.log(`🆔 ID:        ${myPool.investmentId}`);
        } else {
            console.log(`⚠️ Search succeeded, but Pool ${POOL_ID} wasn't in the top results.`);
        }

        console.log("\n✅ Test Complete: CLI is responding correctly.");

    } catch (error) {
        console.error("\n❌ TEST FAILED:", error.message);
    }
}

testYieldHunter();