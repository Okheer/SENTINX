// scripts/seedTestData.js
// Generates a mix of fake bot wallets and real-looking diverse wallets.
// Run: node scripts/seedTestData.js
// Output: /tmp/pending_addresses.json ready for the agent to process.

// scripts/seedTestData.js
import { ethers } from "ethers";
import { writeFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// 10 random bot wallets — no history, no diversity


// 10 fresh random wallets — guaranteed to fail (no history)
const bots = Array.from({ length: 10 }, () =>
    ethers.Wallet.createRandom().address
);

// 5 known active wallets — will pass diversity check
const realUsers = [
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
    "0x388C818CA8B9251b393131C08a736A67ccB19297",
    "0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF",
    "0x6E0d01A76C3Cf4288372a29124A26D4353EE51BE",
    "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
];

const all = [...bots, ...realUsers];
writeFileSync("/tmp/pending_addresses.json", JSON.stringify(all), "utf8");

console.log(`✅ Written ${all.length} addresses to queue`);
console.log(`   ${bots.length} bots     → will be REJECTED`);
console.log(`   ${realUsers.length} real users → should PASS`);
console.log("\nNow run: npm start");
