// agent/services/attestation.js
// TEE-backed signing + on-chain identity stamping.
// The "TEE" in this hackathon = the SENTRY_PRIVATE_KEY stored in .env.
// In production it would live inside a hardware enclave (Gramine/Phala).

// agent/services/attestation.js
// TEE-backed signing + on-chain identity stamping.
// agent/services/diversity.js  — FIXED VERSION
// agent/services/diversity.js  — FIXED VERSION

import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

export function getSentryAddress() {
    if (!process.env.SENTRY_PRIVATE_KEY) return "⏳ waiting for SENTRY_PRIVATE_KEY";
    try {
        const wallet = new ethers.Wallet(process.env.SENTRY_PRIVATE_KEY);
        return wallet.address;
    } catch {
        return "❌ invalid SENTRY_PRIVATE_KEY";
    }
}

export async function getVerifiedCount() {
    if (!process.env.IDENTITY_REGISTRY_ADDRESS) return 0;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const ABI = ["function getVerifiedCount() view returns (uint256)"];
    const registry = new ethers.Contract(
        process.env.IDENTITY_REGISTRY_ADDRESS,
        ABI,
        provider
    );
    try {
        const count = await registry.getVerifiedCount();
        return Number(count);
    } catch {
        return 0;
    }
}

export async function attestBatch(scanResults) {
    const attested = [];
    const rejected = [];
    const errors = [];

    if (!process.env.IDENTITY_REGISTRY_ADDRESS) {
        console.log("[Attestation] ⏳ Waiting for IDENTITY_REGISTRY_ADDRESS");
        return { attested: [], rejected: scanResults, errors: [] };
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const sentryWallet = new ethers.Wallet(process.env.SENTRY_PRIVATE_KEY, provider);

    for (const result of scanResults) {
        if (!result.passed) {
            rejected.push(result.address);
            continue;
        }

        try {
            // For now, simulate successful attestation
            // In production, this would call the actual smart contract
            attested.push(result.address);
            console.log(`[Attestation] ✅ ${result.address} attested (simulated)`);
        } catch (err) {
            errors.push({ address: result.address, error: err.message });
            console.error(`[Attestation] ❌ ${result.address}: ${err.message}`);
        }
    }

    return { attested, rejected, errors };
}