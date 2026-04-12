import { ethers } from 'ethers';
import { OnchainOS } from '@okx/onchain-os-sdk'; 
import { REGISTRY_CONTRACT_ADDRESS, registryInterface } from '../utils/contract.js';

export async function issueOnchainAttestation(targetUserAddress, ipfsCid) {
    console.log(`🛡️ Guardian is preparing to sign attestation for: ${targetUserAddress}...`);

    try {
        const provider = new ethers.JsonRpcProvider("https://testrpc.xlayer.tech");

    
        const agenticWallet = new OnchainOS.Wallet({
            apiKey: process.env.OKX_API_KEY,
            secretKey: process.env.OKX_SECRET_KEY,
            passphrase: process.env.OKX_PASSPHRASE,
            provider: provider 
        });

        const txData = registryInterface.encodeFunctionData("issueAttestation", [
            targetUserAddress, 
            ipfsCid
        ]);

        console.log("✍️ Requesting TEE Enclave to sign transaction...");

        // 4. Send the transaction!
        const tx = await agenticWallet.sendTransaction({
            to: REGISTRY_CONTRACT_ADDRESS,
            data: txData,
  
        });

        console.log(`✅ Transaction submitted!`);
        console.log(`🔗 Explorer URL: https://www.okx.com/web3/explorer/xlayer-test/tx/${tx.hash}`);
        
        await tx.wait();
        console.log("🎉 Attestation successfully minted on-chain!");
        
        return tx.hash;

    } catch (error) {
        console.error("❌ Guardian Signing Failed:", error.message);
        throw error;
    }
}