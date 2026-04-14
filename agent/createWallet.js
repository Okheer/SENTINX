import { Wallet } from "ethers";

const wallet = Wallet.createRandom();

console.log("Sentry Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);