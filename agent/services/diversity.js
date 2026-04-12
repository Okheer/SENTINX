import { ethers } from 'ethers';

export async function checkDiversity(targetUserAddress) {
    console.log(`🔍 Sentinel analyzing wallet: ${targetUserAddress}...`);

    try {
        const rpcUrl = "https://testrpc.xlayer.tech"; 
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Fetch On-chain Data directly
        const balanceWei = await provider.getBalance(targetUserAddress);
        const balanceEth = ethers.formatEther(balanceWei);
        const txCount = await provider.getTransactionCount(targetUserAddress);

        console.log(`📊 On-chain Stats -> Balance: ${balanceEth} OKB | Tx Count: ${txCount}`);

        
        const isHuman = txCount > 0 || parseFloat(balanceEth) > 0;

        return {
            isHuman,
            report: {
                target: targetUserAddress,
                network: "X Layer",
                txCount: txCount,
                balance: balanceEth,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error("Sentinel Analysis Failed:", error.message);
        return { isHuman: false, error: error.message };
    }
}