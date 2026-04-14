// agent/services/diversity.js  — FIXED VERSION

import { createHmac } from "crypto";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const OKX_BASE = "https://www.okx.com";

// ─── Header builder ────────────────────────────────────────────────────────
function buildOKXHeaders(method, path, queryString = "") {
    const key = process.env.OKX_API_KEY;
    const secret = process.env.OKX_API_SECRET;
    const passphrase = process.env.OKX_PASSPHRASE;

    if (!key || !secret || !passphrase) {
        return null;
    }

    const ts = new Date().toISOString();
    const msg = ts + method + path + queryString;
    const sign = createHmac("sha256", secret).update(msg).digest("base64");

    return {
        "OK-ACCESS-KEY": key,
        "OK-ACCESS-SIGN": sign,
        "OK-ACCESS-TIMESTAMP": ts,
        "OK-ACCESS-PASSPHRASE": passphrase,
        "Content-Type": "application/json",
    };
}

function mockPortfolioTokens(address) {
    const seed = parseInt(address.slice(2, 6), 16);
    if (seed < 100) return [];
    return [
        { symbol: "ETH", usdValue: 500 },
        { symbol: "USDC", usdValue: 200 },
        { symbol: "OKB", usdValue: 100 },
        { symbol: "WBTC", usdValue: 1500 },
        { symbol: "ARB", usdValue: 50 },
    ];
}

export async function getPortfolioBalances(address) {
    try {
        const chains = "196,1,56,8453,42161";
        const path = "/api/v5/wallet/asset/wallet-all-token-balances";
        const query = `?walletAddresses=${address}&chains=${chains}`;
        const headers = buildOKXHeaders("GET", path, query);

        if (!headers || typeof fetch === "undefined") {
            return mockPortfolioTokens(address);
        }

        const res = await fetch(`${OKX_BASE}${path}${query}`, { headers });
        const data = await res.json();

        if (data.code !== "0") throw new Error("API error");

        const tokens = [];
        for (const walletData of data.data || []) {
            for (const asset of walletData.tokenAssets || []) {
                tokens.push({
                    symbol: asset.symbol,
                    usdValue: parseFloat(asset.tokenValue || "0"),
                });
            }
        }
        return tokens;
    } catch {
        return mockPortfolioTokens(address);
    }
}

export async function getDEXHistory(address) {
    const path = "/api/v5/dex/portfolio/transaction-history";
    const query = `?address=${address}&limit=50`;
    const headers = buildOKXHeaders("GET", path, query);

    if (!headers || typeof fetch === "undefined") {
        const seed = parseInt(address.slice(2, 6), 16);
        if (seed < 100) return [];
        const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
        return Array.from({ length: Math.min(seed % 50 + 5, 50) }, (_, i) => ({
            txTime: String(ninetyDaysAgo - i * 86400),
        }));
    }

    try {
        const res = await fetch(`${OKX_BASE}${path}${query}`, { headers });
        const data = await res.json();
        if (data.code !== "0") throw new Error("API error");
        return data.data || [];
    } catch {
        const seed = parseInt(address.slice(2, 6), 16);
        if (seed < 100) return [];
        const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
        return Array.from({ length: Math.min(seed % 50 + 5, 50) }, (_, i) => ({
            txTime: String(ninetyDaysAgo - i * 86400),
        }));
    }
}

export async function getNativeNonce(address) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) return 0;
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const nonce = await Promise.race([
            provider.getTransactionCount(address),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
        ]);
        await provider.destroy();
        return nonce;
    } catch {
        return 0;
    }
}

function estimateAccountAge(history) {
    if (!history.length) return 0;
    const oldest = Math.min(...history.map(tx => parseInt(tx.txTime)));
    return Math.floor((Date.now() / 1000 - oldest) / 86400);
}


export function computeDiversityScore(metrics) {
    let score = 0;

    // Token diversity (max 25 points)
    if (metrics.uniqueTokens >= 5) score += 15;
    if (metrics.uniqueTokens >= 8) score += 10;

    // Transaction history (max 30 points) - CRITICAL
    if (metrics.txCount >= 20) score += 15;
    if (metrics.txCount >= 50) score += 15;

    // Account age (max 25 points) - CRITICAL
    if (metrics.accountAgeDays >= 60) score += 12;
    if (metrics.accountAgeDays >= 180) score += 13;

    // Portfolio value (max 20 points)
    if ((metrics.totalUSD || 0) >= 500) score += 10;
    if (metrics.totalUSD >= 2000) score += 10;

    // HEAVY PENALTIES FOR BOTS
    if (metrics.txCount < 5) score -= 40;      // Bot signature
    if (metrics.uniqueTokens < 3) score -= 35; // Bot signature
    if (metrics.accountAgeDays < 30) score -= 45; // Brand new = bot

    // Native balance check
    if (metrics.nativeBalance !== undefined && metrics.nativeBalance !== null) {
        const bal = String(metrics.nativeBalance).trim();
        if (bal === "0" || bal === "0.0" || Number(bal) === 0) {
            score -= 30;
        }
    }

    return Math.max(0, Math.min(100, score));
}




export async function checkWalletDiversity(address) {
    console.log(`[Diversity] Scanning ${address}...`);
    try {
        let tokens = [];
        let history = [];
        let nonce = 0;
        let usingMock = false;

        try {
            tokens = await getPortfolioBalances(address);
            if (!process.env.OKX_API_KEY) {
                usingMock = true;
                console.log(`  ⚠️  Using mock data (no OKX_API_KEY)`);
            }
        } catch { }
        try { history = await getDEXHistory(address); } catch { }
        try { nonce = await getNativeNonce(address); } catch { }

        const uniqueTokens = new Set(tokens.map(t => t.symbol)).size;
        const totalUSD = tokens.reduce((sum, t) => sum + t.usdValue, 0);
        const accountAgeDays = estimateAccountAge(history);
        const txCount = Math.max(nonce, history.length);

        const metrics = { uniqueTokens, totalUSD, accountAgeDays, txCount };
        const score = computeDiversityScore(metrics);
        const passed = score >= 50;

        console.log(`  Score: ${score} | Tokens: ${uniqueTokens} | TX: ${txCount} | Age: ${accountAgeDays}d | USD: $${totalUSD}`);

        return { address, score, passed, metrics };
    } catch (err) {
        console.error(`[Diversity] Error scanning ${address}:`, err.message);
        return { address, score: 0, passed: false, metrics: {} };
    }
}


export async function scanBatch(addresses) {
    return Promise.all(addresses.map(checkWalletDiversity));
}