
import { pinEvidenceToIPFS } from './utils/ipfsClient.js';

async function runTest() {
    console.log("🕵️ Checking ENV variables:");
  console.log("API Key Loaded:", !!process.env.PINATA_API_KEY);
  console.log("🚀 Starting IPFS Smoke Test...");

  const mockEvidence = {
    project: "SENTINX",
    role: "Guardian Test",
    timestamp: new Date().toISOString(),
    diversityScore: 85,
    status: "Proof of Concept"
  };

  try {
    const cid = await pinEvidenceToIPFS(mockEvidence);
    console.log("✅ Success! Your evidence is live on the decentralized web.");
    console.log("🔗 URL:", `https://gateway.pinata.cloud/ipfs/${cid.replace('ipfs://', '')}`);
    console.log("📄 CID:", cid);
  } catch (error) {
    console.error("❌ Test Failed!");
    console.error("Reason:", error.message);
  }
}

runTest();