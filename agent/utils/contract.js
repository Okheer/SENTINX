import { ethers } from 'ethers';

export const REGISTRY_CONTRACT_ADDRESS = "0xD2D82Fed32FB9A911300e7d928607755bD101773";


const registryABI = [
    "function issueAttestation(address user, string cid) external"
];

export const registryInterface = new ethers.Interface(registryABI);