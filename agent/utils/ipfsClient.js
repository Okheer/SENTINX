// agent/utils/ipfsClient.js
// Uploads evidence JSON to IPFS via Pinata.
// Person D provides the PINATA_JWT after setting up the account.
// Until they do, this module uses a mock that returns a fake CID.

import dotenv from "dotenv";
dotenv.config();

const PINATA_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

/**
 * Upload a JSON object to IPFS.
 * Returns the IPFS CID (e.g., "QmXyz...").
 * Falls back to a deterministic mock CID if PINATA_JWT is not set.
 */
export async function uploadToIPFS(jsonData) {
    // Mock mode when IPFS not yet configured
    if (!process.env.PINATA_JWT) {
        const mockCid = "QmMOCK_" + Buffer.from(JSON.stringify(jsonData))
            .toString("hex").slice(0, 20);
        console.log(`[IPFS] Mock mode — returning fake CID: ${mockCid}`);
        return mockCid;
    }

    const response = await fetch(PINATA_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.PINATA_JWT}`,
        },
        body: JSON.stringify({
            pinataContent: jsonData,
            pinataMetadata: {
                name: `sentinx-audit-${jsonData.user_address}-${jsonData.check_timestamp}`,
            },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`IPFS upload failed: ${response.status} — ${err}`);
    }

    const result = await response.json();
    console.log(`[IPFS] Uploaded → CID: ${result.IpfsHash}`);
    return result.IpfsHash;
}

/**
 * Build the standard audit evidence JSON.
 * This is the schema defined in the SENTINX spec.
 */
export function buildAuditJSON(address, metrics, signature) {
    return {
        agent_id: "SENTINX_01",
        user_address: address,
        check_timestamp: Math.floor(Date.now() / 1000),
        diversity_metrics: {
            total_tx: metrics.txCount,
            unique_tokens: metrics.uniqueTokens,
            account_age_days: metrics.accountAgeDays,
            total_usd: metrics.totalUSD,
            proof_hashes: metrics.proofHashes || [],
        },
        passed: metrics.passed,
        attestation: signature || "UNSIGNED",
    };
}