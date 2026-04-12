// agent/services/attestation.js
// TEE-backed signing + on-chain identity stamping.
// The "TEE" in this hackathon = the SENTRY_PRIVATE_KEY stored in .env.
// In production it would live inside a hardware enclave (Gramine/Phala).

// agent/services/attestation.js
// TEE-backed signing + on-chain identity stamping.

import { ethers } from "ethers";

// ─── Dynamic Dependency Loading ─────────────────────────────────────────────
// This ensures the service works even if Person D hasn't finished IPFS utils.
let uploadToIPFS = async () => "QmMockCID";
let buildAuditJSON = (address, metrics, signature) => ({
    address,
    metrics,
    signature,
});

async function loadDependencies() {
    try {
        // Use dynamic import for ES Modules compatibility
        const ipfs = await import("../utils/ipfsClient.js");
        uploadToIPFS = ipfs.uploadToIPFS;
        buildAuditJSON = ipfs.buildAuditJSON;
    } catch (err) {
        // Fallback stays active if file doesn't exist yet
    }
}
loadDependencies();

// ─── Setup ─────────────────────────────────────────────────────────────────
let provider = null;
if (process.env.RPC_URL) {
    provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
}

// Ensure private key exists to prevent crash on startup
const privateKey = process.env.SENTRY_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const sentryWallet = new ethers.Wallet(
    privateKey,
    provider || undefined
);

const REGISTRY_ABI = [
    "function issueAttestation(address _user, string memory _cid) external",
    "function isVerified(address) view returns (bool)",
    "function auditTrail(address) view returns (string)",
    "function getVerifiedCount() view returns (uint256)",
];

function getRegistry() {
    if (!process.env.IDENTITY_REGISTRY_ADDRESS) {
        throw new Error("IDENTITY_REGISTRY_ADDRESS not set in .env — ask Person A");
    }
    return new ethers.Contract(
        process.env.IDENTITY_REGISTRY_ADDRESS,
        REGISTRY_ABI,
        sentryWallet
    );
}

// ─── TEE Signature Logic ───────────────────────────────────────────────────

export async function createAttestationSignature(userAddress, ipfsCID) {
    // Standardize address to prevent checksum mismatches
    const cleanAddress = ethers.getAddress(userAddress);

    const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string"],
        [cleanAddress, ipfsCID]
    );

    // signMessage handles the "\x19Ethereum Signed Message:\n32" prefix
    const signature = await sentryWallet.signMessage(
        ethers.getBytes(messageHash)
    );

    return { messageHash, signature };
}

export async function attestUser(scanResult) {
    const { address, metrics, proofHashes } = scanResult;

    if (!scanResult.passed) {
        throw new Error(`Cannot attest ${address}: diversity check failed (score ${scanResult.score})`);
    }
    if (!process.env.IDENTITY_REGISTRY_ADDRESS) {
        throw new Error("IDENTITY_REGISTRY_ADDRESS not set in .env — cannot attest on-chain");
    }

    console.log(`[Attestation] Attesting ${address}...`);

    // Step 1: Build temporary evidence for signing
    const evidence = buildAuditJSON(address, metrics, "PENDING_SIGNATURE");

    // Step 2: Create deterministic hash for the signature
    const tempCID = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(evidence))
    ).slice(0, 46);

    const { signature } = await createAttestationSignature(address, tempCID);

    // Step 3: Build final evidence and upload
    const finalEvidence = buildAuditJSON(
        address,
        { ...metrics, proofHashes },
        signature
    );
    const cid = await uploadToIPFS(finalEvidence);

    // Step 4: Write on-chain stamp
    const registry = getRegistry();

    const alreadyVerified = await registry.isVerified(address);
    if (alreadyVerified) {
        console.log(`[Attestation] ${address} already verified, skipping.`);
        return { cid, txHash: null, signature, alreadyVerified: true };
    }

    const tx = await registry.issueAttestation(address, cid);
    const receipt = await tx.wait();

    console.log(`[Attestation] ✓ ${address} stamped on-chain. Tx: ${receipt.hash}`);

    return { cid, txHash: receipt.hash, signature, alreadyVerified: false };
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
            console.error(`[Attestation] Error for ${result.address}:`, err.message);
            errors.push({ address: result.address, error: err.message });
        }

        // Delay to prevent nonce collisions on X Layer
        await new Promise(r => setTimeout(r, 1000));
    }

    return { attested, rejected, errors };
}

export function getSentryAddress() {
    return sentryWallet.address;
}

export async function getVerifiedCount() {
    try {
        const registry = getRegistry();
        const count = await registry.getVerifiedCount();
        return Number(count);
    } catch (e) { return 0; }
}