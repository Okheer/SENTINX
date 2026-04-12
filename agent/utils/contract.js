import { ethers } from 'ethers';

export const REGISTRY_CONTRACT_ADDRESS = "0xYourTeamContractAddressHere";


const registryABI = [
    "function issueAttestation(address user, string cid) external"
];

export const registryInterface = new ethers.Interface(registryABI);