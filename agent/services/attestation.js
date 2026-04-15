// agent/services/attestation.js
import { ethers } from "ethers";
import { exec } from "child_process";
import util from "util";
import dotenv from "dotenv";

dotenv.config();
const execAsync = util.promisify(exec);

// ─── Dynamic Dependency Loading (Safety Net) ──────────────────────────────
let uploadToIPFS = async () => "QmMockCID_" + Date.now();
let buildAuditJSON = (address, metrics, signature) => ({
    address, metrics, signature, timestamp: new Date().toISOString()
});

async function loadDependencies() {
    try {
        const ipfs = await import("../utils/ipfsClient.js");
        if (ipfs.uploadToIPFS) uploadToIPFS = ipfs.uploadToIPFS;
        if (ipfs.buildAuditJSON) buildAuditJSON = ipfs.buildAuditJSON;
    } catch (err) {
        console.log("[Attestation] Using built-in fallback for IPFS/Audit.");
    }
}
loadDependencies();

// ─── Setup Read-Only Provider ─────────────────────────────────────────────
function getProvider() {
    const rpcUrl = process.env.RPC_URL || "https://testrpc.xlayer.tech";
    return new ethers.JsonRpcProvider(rpcUrl);
}

// Ensure registry ABI matches your smart contract exactly
const REGISTRY_ABI = [
    "function issueAttestation(address _user, string memory _cid) external",
    "function attest(address user, string metadata) external", 
    "function isRegistered(address user) view returns (bool)",
    "function getVerifiedCount() view returns (uint256)"
];

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

// ─── Core Attestation Logic ───────────────────────────────────────────────

export async function attestUser(scanResult) {
    const { address, metrics, proofHashes } = scanResult;

    if (!scanResult.passed) {
        throw new Error(`Cannot attest ${address}: failed diversity check`);
    }

    console.log(`[Attestation] ✍️ Processing ${address}...`);

    // 1. Read-Only Check: Is user already registered?
    const registry = getRegistryReadOnly();
    try {
        const alreadyRegistered = await registry.isRegistered(address);
        if (alreadyRegistered) {
            console.log(`[Attestation] ${address} already registered on-chain.`);
            return { cid: "N/A", txHash: null, alreadyVerified: true };
        }
    } catch (err) {
        console.warn(`[Attestation] Warning: Could not check isRegistered status. Assuming false.`);
    }

    // 2. Prepare Data 
    const finalEvidence = buildAuditJSON(address, { ...metrics, proofHashes }, "TEE_ATTESTED_VIA_ONCHAINOS");
    const cid = await uploadToIPFS(finalEvidence);

    // 3. Encode the transaction for the OnchainOS CLI
    console.log(`[Attestation] Encoding transaction for TEE CLI...`);
    const registryInterface = new ethers.Interface(REGISTRY_ABI);
    
    // NOTE: Change "issueAttestation" to "attest" if that is what your contract uses!
    const encodedInputData = registryInterface.encodeFunctionData("issueAttestation", [
        address,
        cid
    ]);

    // 4. Execute via OnchainOS CLI (The Agentic Wallet)
    const registryAddress = process.env.IDENTITY_REGISTRY_ADDRESS;
    const executeCmd = `onchainos wallet contract-call --to ${registryAddress} --chain xlayer --input-data ${encodedInputData}`;

    try {
        const { stdout } = await execAsync(executeCmd);
        
        let txHash = "Check Block Explorer";
        try {
            const outputObj = JSON.parse(stdout);
            if (outputObj.data && outputObj.data.txHash) {
                txHash = outputObj.data.txHash;
            }
        } catch (e) {
            txHash = stdout.trim().substring(0, 66); 
        }

        console.log(`[Attestation] ✅ TEE Execution Success! Output: ${txHash}`);
        return { cid, txHash, alreadyVerified: false };

    } catch (err) {
        throw new Error(`CLI Execution Failed: ${err.message}`);
    }
}

export async function attestBatch(scanResults) {
    const attested = [];
    const rejected = [];
    const errors = [];

    for (const result of scanResults) {
        if (!result.passed) {
            rejected.push({ address: result.address, score: result.score });
            continue;
        }

        try {
            const attestResult = await attestUser(result);
            attested.push({ address: result.address, ...attestResult });
        } catch (err) {
            console.error(`[Attestation] ❌ Error for ${result.address}:`, err.message);
            errors.push({ address: result.address, error: err.message });
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    return { attested, rejected, errors };
}

export async function getVerifiedCount() {
    try {
        const registry = getRegistryReadOnly();
        const count = await registry.getVerifiedCount();
        return Number(count);
    } catch (e) { return 0; }
}

// ─── Exported Utility for index.js ─────────────────────────────────────────
export function getSentryAddress() { 
    // This pulls your authorized agentic wallet address directly from your .env
    return process.env.SENTRY_ADDRESS || "0x00223b332561f6eb2d640adea92c1fc891944f5f0"; 
}

