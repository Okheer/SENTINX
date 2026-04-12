import { checkDiversity } from './services/diversity.js';
import { pinEvidenceToIPFS } from './utils/ipfsClient.js';
import { issueOnchainAttestation } from './services/guardian.js';

async function runSentinel(walletList) {
    console.log(`🚀 Starting Milestone Verification for ${walletList.length} addresses...`);
    
    let stats = { humans: 0, bots: 0 };

    for (const targetWallet of walletList) {
        console.log(`\n-----------------------------------------`);
        console.log(`🔍 Analyzing: ${targetWallet}`);
        
        try {
            // 1. Analyze (Role B's Logic)
            const report = await checkDiversity(targetWallet);
            
            if (report.isHuman) {
                console.log("🌟 Human detected!");
                
                // 2. Upload to IPFS (One time only!)
                const cidUri = await pinEvidenceToIPFS(report.report); 
                console.log(`🔒 Evidence locked at: ${cidUri}`);

                // 3. On-chain Attestation (Role D's TEE/Ethers Logic)
                console.log("⚡ Triggering Guardian to sign...");
                const txHash = await issueOnchainAttestation(targetWallet, cidUri);
                
                console.log(`✅ Success! Hash: ${txHash}`);
                stats.humans++;
            } else {
                console.log("🤖 Potential bot detected. Skipping attestation.");
                stats.bots++;
            }
        } catch (error) {
            console.error(`❌ Error processing ${targetWallet}:`, error.message);
        }
    }

    console.log(`\n=========================================`);
    console.log(`🏁 BATCH COMPLETE`);
    console.log(`✅ Humans Verified: ${stats.humans}`);
    console.log(`🚫 Bots Rejected: ${stats.bots}`);
    console.log(`=========================================`);
}

// Example: The list the Founder would submit via the Frontend
const founderSubmission = [
    "0x94A4365E6B7E79791258A3Fa071824BC2b75a394", 
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Random test wallet
    "0x0000000000000000000000000000000000000000"  // Should fail
];

runSentinel(founderSubmission);