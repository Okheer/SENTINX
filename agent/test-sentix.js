import { checkDiversity } from './services/diversity.js';
import { pinEvidenceToIPFS } from './utils/ipfsClient.js';
import { issueOnchainAttestation } from './services/guardian.js';

async function runSentinel() {
    const targetWallet = "0x0332EEfd726c800a628f69D0D26040B21858F497"; // Replace with any active wallet for testing
    
    // 1. Analyze
    const report = await checkDiversity(targetWallet);
    
    if (report.isHuman) {
        console.log("🌟 Human detected! Archiving evidence...");
        
        // 2. Upload to IPFS
        const cid = await pinEvidenceToIPFS(report.report);

        const cidUri = await pinEvidenceToIPFS(report.report); 
        console.log(`🔒 Evidence locked at: ${cidUri}`);
        
        // 3. TEE Signing (Simulated via CLI broadcast)
        console.log(`✍️ Guardian (TEE) is now signing attestation with CID: ${cid}`);
        console.log("🚀 Transaction would be sent to X Layer Registry now.");
    } else {
        console.log("🤖 Potential bot detected. No attestation issued.");
    }
}

runSentinel();