import { ethers } from 'ethers';
import { REGISTRY_CONTRACT_ADDRESS, registryInterface } from '../utils/contract.js';

export async function issueOnchainAttestation(targetUserAddress, ipfsCid) {
    console.log(`🛡️ Guardian is preparing to sign attestation for: ${targetUserAddress}...`);

    try {
        // 1. Connect to the X Layer Testnet RPC
        const provider = new ethers.JsonRpcProvider("https://testrpc.xlayer.tech");

        // 2. Initialize the Wallet using native Ethers.js and your private key
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error("Missing PRIVATE_KEY in .env file!");
        
        const agenticWallet = new ethers.Wallet(privateKey, provider);

        // 3. Encode the transaction data
        const txData = registryInterface.encodeFunctionData("issueAttestation", [
            targetUserAddress, 
            ipfsCid
        ]);

        console.log("✍️ Requesting wallet to sign transaction...");

        // 4. Send the transaction!
        const tx = await agenticWallet.sendTransaction({
            to: REGISTRY_CONTRACT_ADDRESS,
            data: txData
        });

        console.log(`✅ Transaction submitted!`);
        console.log(`🔗 Explorer URL: https://www.oklink.com/xlayer-test/tx/${tx.hash}`);
        
        // Wait for it to be mined
        await tx.wait();
        console.log("🎉 Attestation successfully minted on-chain!");
        
        return tx.hash;

    } catch (error) {
        console.error("❌ Guardian Signing Failed:", error.message);
        throw error;
    }
}