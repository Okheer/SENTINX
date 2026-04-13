import { checkWalletDiversity } from './services/diversity.js';
import { pinEvidenceToIPFS } from './utils/ipfsClient.js';
import { issueOnchainAttestation } from './services/guardian.js';

async function runSentinel(walletList) {
    console.log(`🚀 Starting Strict Milestone Verification for ${walletList.length} addresses...`);
    console.log(`=========================================`);
    
    // --- STAGE 1: THE AUDIT (No gas spent, no IPFS pinning) ---
    console.log("🧐 STAGE 1: Auditing all addresses for bot activity...");
    const auditReports = [];

    for (const targetWallet of walletList) {
        console.log(`\n🔍 Analyzing: ${targetWallet}`);
        
        try {
            // Call Person B's actual function
            const report = await checkWalletDiversity(targetWallet);
            
            // Check her specific 'passed' boolean
            if (!report.passed) {
                console.error(`🛑 CRITICAL FAILURE: Wallet ${targetWallet} flagged as a BOT (Score: ${report.score}/100).`);
                console.log("❌ Entire batch rejected. No transactions will be sent. VC funds protected.");
                return; // 👈 THIS ABORTS THE ENTIRE PROCESS IMMEDIATELY
            }
            
            console.log(`🌟 Human detected! (Score: ${report.score}/100)`);
            
            // Save the report so we don't have to fetch it again
            auditReports.push({ wallet: targetWallet, data: report });

        } catch (error) {
            console.error(`⚠️ Network Error auditing ${targetWallet}:`, error.message);
            console.log("❌ Aborting batch due to scanning error.");
            return; 
        }
    }

    // --- STAGE 2: THE EXECUTION (Only runs if ALL passed Stage 1) ---
    console.log(`\n=========================================`);
    console.log("✨ STAGE 2: All addresses passed! Starting On-chain Attestation...");
    
    let successCount = 0;

    for (const entry of auditReports) {
        console.log(`\n⚙️ Processing Execution for: ${entry.wallet}`);
        try {
            // 1. Upload the full proof data to IPFS (Role D logic)
            const cidUri = await pinEvidenceToIPFS(entry.data); 
            console.log(`🔒 Evidence locked at: ${cidUri}`);

            // 2. On-chain Attestation (Role D logic)
            console.log("⚡ Triggering Guardian to sign...");
            const txHash = await issueOnchainAttestation(entry.wallet, cidUri);
            
            console.log(`✅ Success! Hash: ${txHash}`);
            successCount++;
        } catch (error) {
            console.error(`❌ Critical error during execution for ${entry.wallet}:`, error.message);
        }
    }

    console.log(`\n=========================================`);
    console.log(`🏁 BATCH COMPLETE`);
    console.log(`🏆 Successfully Verified & Minted: ${successCount} / ${walletList.length}`);
    console.log(`=========================================`);
}

// Demo Data: Vitalik's address (will pass) and a Zero address (will fail)
const founderSubmission = [
    "0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e", // Vitalik - Should Pass
    "0x94A4365E6B7E79791258A3Fa071824BC2b75a394"  // Bot/Empty - Should Fail & Abort Batch
];

runSentinel(founderSubmission);