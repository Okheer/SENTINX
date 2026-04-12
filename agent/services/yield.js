import { ethers } from "ethers";

const CHAIN_INDEX = "196";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const USDC_ADDRESS =
    process.env.USDC_ADDRESS_XLAYER ||
    "0x74b7f16337b8972027f6196a17a631ac6de26d22";

const YIELD_TARGET =
    process.env.YIELD_TOKEN_XLAYER || NATIVE_TOKEN;

// ✅ LAZY PROVIDER/WALLET
let provider = null;
let sentryWallet = null;

function getProvider() {
    if (!provider) {
        const rpc = process.env.RPC_URL || "https://testrpc.xlayer.tech";
        provider = new ethers.JsonRpcProvider(rpc);
    }
    return provider;
}

function getWallet() {
    if (!process.env.SENTRY_PRIVATE_KEY) {
        throw new Error("SENTRY_PRIVATE_KEY not set");
    }

    if (!sentryWallet) {
        sentryWallet = new ethers.Wallet(
            process.env.SENTRY_PRIVATE_KEY,
            getProvider()
        );
    }
    return sentryWallet;
}
// ✅ FIXED: Lazy SDK import
let _dexClient = null;

async function getDexClient() {
    if (!_dexClient && process.env.OKX_API_KEY) {
        const { OKXDexClient } = await import("@okx-dex/okx-dex-sdk");

        _dexClient = new OKXDexClient({
            apiKey: process.env.OKX_API_KEY,
            secretKey: process.env.OKX_API_SECRET,
            apiPassphrase: process.env.OKX_PASSPHRASE,
            evm: {
                wallet: {
                    privateKey: process.env.SENTRY_PRIVATE_KEY,
                    provider: getProvider(),
                },
            },
        });
    }
    return _dexClient;
}

// ─── Vault ─────────────────────────────

const VAULT_ABI = [
    "function withdrawForYield(uint256 amount) external",
    "function returnFromYield(uint256 amount) external",
    "function state() view returns (uint8)",
];

function getVault() {
    if (!process.env.SENTINX_ESCROW_ADDRESS) {
        throw new Error("SENTINX_ESCROW_ADDRESS not set");
    }

    return new ethers.Contract(
        process.env.SENTINX_ESCROW_ADDRESS,
        VAULT_ABI,
        getWallet()
    );
}

// ─── Yield Logic ───────────────────────

export async function deployToYield(usdcAmount) {
    const vault = getVault();

    console.log(
        `[Yield] Deploying ${ethers.formatUnits(usdcAmount, 6)} USDC...`
    );

    const state = await vault.state();

    if (state !== 1n) {
        return null;
    }

    const withdrawTx = await vault.withdrawForYield(usdcAmount);
    await withdrawTx.wait();

    const dex = await getDexClient(); // ✅ FIXED
    if (!dex) {
        return { txHash: "MOCK_YIELD_TX", amount: usdcAmount.toString() };
    }

    const result = await dex.dex.executeSwap({
        chainIndex: CHAIN_INDEX,
        fromTokenAddress: USDC_ADDRESS,
        toTokenAddress: YIELD_TARGET,
        amount: usdcAmount.toString(),
        slippagePercent: "0.5",
        userWalletAddress: getWallet().address,
    });

    return { txHash: result.transactionHash, amount: usdcAmount.toString() };
}

export async function returnFromYield(targetAmount) {
    const dex = await getDexClient(); // ✅ FIXED

    if (dex) {
        try {
            const IERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
            let yieldBalance;

            if (YIELD_TARGET === NATIVE_TOKEN) {
                yieldBalance = await getProvider().getBalance(getWallet().address);
            } else {
                const token = new ethers.Contract(
                    YIELD_TARGET,
                    IERC20_ABI,
                    getProvider()
                );
                yieldBalance = await token.balanceOf(getWallet().address);
            }

            if (yieldBalance > 0n) {
                await dex.dex.executeSwap({
                    chainIndex: CHAIN_INDEX,
                    fromTokenAddress: YIELD_TARGET,
                    toTokenAddress: USDC_ADDRESS,
                    amount: yieldBalance.toString(),
                    slippagePercent: "1.0",
                    userWalletAddress: getWallet().address,
                });
            }
        } catch { }
    }

    const vault = getVault();

    const USDC = new ethers.Contract(
        USDC_ADDRESS,
        ["function approve(address,uint256) returns (bool)"],
        getWallet()
    );

    await (
        await USDC.approve(process.env.SENTINX_ESCROW_ADDRESS, targetAmount)
    ).wait();

    const tx = await vault.returnFromYield(targetAmount);
    await tx.wait();

    return tx.hash;
}

export async function estimateYield(deployedAmount) {
    try {
        const IERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
        let yieldBalance;

        if (YIELD_TARGET === NATIVE_TOKEN) {
            yieldBalance = await getProvider().getBalance(getWallet().address);
        } else {
            const yt = new ethers.Contract(
                YIELD_TARGET,
                IERC20_ABI,
                getProvider()
            );
            yieldBalance = await yt.balanceOf(getWallet().address);
        }

        if (yieldBalance === 0n) {
            return { earnedUSD: 0, yieldPct: 0 };
        }

        const dex = await getDexClient(); // ✅ FIXED
        if (!dex) return { earnedUSD: 0, yieldPct: 0 };

        const quote = await dex.dex.getQuote({
            chainIndex: CHAIN_INDEX,
            fromTokenAddress: YIELD_TARGET,
            toTokenAddress: USDC_ADDRESS,
            amount: yieldBalance.toString(),
            slippagePercent: "0.5",
        });

        const current = BigInt(quote.data[0]?.toTokenAmount || "0");
        const deployed = BigInt(deployedAmount);

        const earned = current - deployed;

        return {
            earnedUSD: parseFloat(ethers.formatUnits(earned, 6)),
            yieldPct:
                (parseFloat(ethers.formatUnits(earned, 6)) /
                    parseFloat(ethers.formatUnits(deployed, 6))) *
                100,
        };
    } catch {
        return { earnedUSD: 0, yieldPct: 0 };
    }
}