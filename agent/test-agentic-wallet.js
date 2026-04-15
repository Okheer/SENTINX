// test-agentic-wallet.js
// Test script to verify OKX agentic wallet setup

import dotenv from 'dotenv';
dotenv.config();

import {
  getAgenticWalletAddress,
  isWalletLoggedIn,
  getWalletBalance,
  encodeEscrowCall,
  approveMilestone,
  slashFounder,
} from './utils/agentic-wallet-utils.js';

const ESCROW_ADDRESS = process.env.SENTINX_ESCROW_ADDRESS || '0x_MISSING';

async function test() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('     OKX Agentic Wallet Setup Verification');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Check if logged in
  console.log('📋 Test 1: Wallet Login Status');
  try {
    const loggedIn = await isWalletLoggedIn();
    if (loggedIn) {
      console.log('✅ Wallet is logged in\n');
    } else {
      console.log('❌ Wallet not logged in');
      console.log('   Run: onchainos wallet login <your-email@example.com>\n');
    }
  } catch (error) {
    console.log(`❌ Check login failed: ${error.message}\n`);
    return;
  }

  // Test 2: Get wallet address
  console.log('📋 Test 2: Wallet Address (X Layer)');
  let walletAddress;
  try {
    walletAddress = await getAgenticWalletAddress();
    console.log(`✅ Address: ${walletAddress}\n`);
  } catch (error) {
    console.log(`❌ Failed to get address: ${error.message}\n`);
    return;
  }

  // Test 3: Check OKB balance
  console.log('📋 Test 3: OKB Balance (X Layer)');
  try {
    const balance = await getWalletBalance('xlayer');
    console.log('✅ Wallet balance retrieved:');
    console.log(`   Total Tokens: ${balance.tokenList?.length || 0}`);
    
    // Find OKB in the list
    if (balance.tokenDetails) {
      const okbToken = balance.tokenDetails.find(t => 
        t.tokenSymbol?.toUpperCase() === 'OKB' ||
        t.name?.toUpperCase().includes('OKB')
      );
      
      if (okbToken) {
        console.log(`   OKB Balance: ${okbToken.amount} (≈ $${okbToken.amountUsd})`);
      } else {
        console.log('   ⚠️  OKB not found in wallet. Fund wallet first!');
      }
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Balance check failed: ${error.message}\n`);
  }

  // Test 4: Verify Escrow address
  console.log('📋 Test 4: Escrow Contract Address');
  if (ESCROW_ADDRESS.includes('_MISSING') || ESCROW_ADDRESS === '0x_MISSING') {
    console.log('❌ SENTINX_ESCROW_ADDRESS not set in .env');
    console.log('   Set in .env before using agentic wallet with Escrow\n');
  } else {
    console.log(`✅ Escrow address: ${ESCROW_ADDRESS}\n`);
  }

  console.log('📋 Test 5: Function Encoding');
  try {
    // Example: encode approveMilestone(1)
    const calldata = encodeEscrowCall('approveMilestone', [1]);
    console.log(`✅ approveMilestone(1) encodes to:`);
    console.log(`   ${calldata}\n`);

    // Example: encode slashFounder(1, "test")
    const calldata2 = encodeEscrowCall('slashFounder', [1, 'test reason']);
    console.log(`✅ slashFounder(1, "test reason") encodes to:`);
    console.log(`   ${calldata2}\n`);
  } catch (error) {
    console.log(`❌ Encoding failed: ${error.message}\n`);
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                       Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`
📝 Next Steps:

1️⃣  Ensure OKB funding:
   $ onchainos wallet balance --chain xlayer

2️⃣  Register wallet as agent (contract owner runs):
   AgentManager.setAgent('${walletAddress}')

3️⃣  Update .env with:
   SENTINX_ESCROW_ADDRESS=<your-escrow-address>
   AGENT_ADDRESS=${walletAddress}

4️⃣  Test contract call:
   npm run test:agentic-call

5️⃣  Start agent loop:
   npm run agent:once

✨ Ready to use agentic wallet with Escrow!
  `);
}

test().catch(console.error);
