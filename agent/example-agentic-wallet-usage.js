// example-agentic-wallet-usage.js
// Example: How to use the agentic wallet in your agent code

import { approveMilestone, slashFounder, deployYield, getAgentAddress } from './services/agent-executor.js';

const ESCROW_ADDRESS = process.env.SENTINX_ESCROW_ADDRESS;

/**
 * Example 1: Approve a Milestone
 * 
 * This is called after attestation confirms founders are legitimate.
 * The agent approves the milestone, allowing founders to claim their payout.
 */
async function exampleApproveMilestone() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Example 1: Approve Milestone');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const milestoneId = 1; // From your attestation logic
    
    console.log(`📝 Approving milestone ${milestoneId}...`);
    const result = await approveMilestone(milestoneId);
    
    if (result.confirming) {
      console.log(`⚠️  Confirmation required:\n${result.message}\n`);
      console.log('🔄 In a real agent, show user confirmation dialog');
      // In production: await userConfirmation() then approveMilestone(milestoneId, { force: true })
    } else if (result.txHash) {
      console.log(`✅ Milestone approved!`);
      console.log(`   TX: ${result.txHash}`);
    }
  } catch (error) {
    console.error(`❌ Failed to approve milestone: ${error.message}`);
  }
}

/**
 * Example 2: Slash a Founder
 * 
 * Called if a founder no-shows or fails verification checks.
 * Returns funds to VC, sends collateral as penalty, returns equity to founder.
 */
async function exampleSlashFounder() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Example 2: Slash Founder (for no-show)');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const escrowId = 1; // From your decision engine
    const reason = 'Founder no-show: Did not meet milestone deadline';
    
    console.log(`🚨 Slashing founder for escrow ${escrowId}...`);
    console.log(`   Reason: ${reason}\n`);
    
    const result = await slashFounder(escrowId, reason);
    
    if (result.confirming) {
      console.log(`⚠️  High-risk action - confirmation required:\n${result.message}\n`);
      // In production: await userConfirmation()
    } else if (result.txHash) {
      console.log(`✅ Founder slashed!`);
      console.log(`   VC refunded + collateral penalty applied`);
      console.log(`   TX: ${result.txHash}`);
    }
  } catch (error) {
    console.error(`❌ Failed to slash founder: ${error.message}`);
  }
}

/**
 * Example 3: Deploy Idle Funds to Yield
 * 
 * Called periodically to maximize returns on idle USDC.
 * Deploys to OKX staking or other yield protocols.
 */
async function exampleDeployYield() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Example 3: Deploy Idle Funds to Yield');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const escrowId = 1;
    const amountInMinimalUnits = '100000000'; // 100 USDC (6 decimals)
    
    console.log(`💰 Deploying yield for escrow ${escrowId}...`);
    console.log(`   Amount: 100 USDC\n`);
    
    const result = await deployYield(escrowId, amountInMinimalUnits);
    
    if (result.confirming) {
      console.log(`⚠️  Confirmation required:\n${result.message}`);
    } else if (result.txHash) {
      console.log(`✅ Yield deployed!`);
      console.log(`   Funds now earning returns on OKX marketplace`);
      console.log(`   TX: ${result.txHash}`);
    }
  } catch (error) {
    console.error(`❌ Failed to deploy yield: ${error.message}`);
  }
}

/**
 * Example 4: Withdraw Yield Profits
 * 
 * Called when collecting earned yield to return to investors.
 */
async function exampleWithdrawYield() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Example 4: Withdraw Yield Profits');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const escrowId = 1;
    const amountInMinimalUnits = '50000000'; // 50 USDC
    
    console.log(`📊 Withdrawing yield profits for escrow ${escrowId}...`);
    console.log(`   Amount: 50 USDC\n`);
    
    const result = await withdrawYield(escrowId, amountInMinimalUnits);
    
    if (result.confirming) {
      console.log(`⚠️  Confirmation required:\n${result.message}`);
    } else if (result.txHash) {
      console.log(`✅ Yield withdrawn!`);
      console.log(`   Profits returned to Escrow`);
      console.log(`   TX: ${result.txHash}`);
    }
  } catch (error) {
    console.error(`❌ Failed to withdraw yield: ${error.message}`);
  }
}

/**
 * Example 5: Decision Engine - Full Loop
 * 
 * Simulates the complete decision-making cycle.
 */
async function exampleFullDecisionLoop() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Example 5: Complete Decision Loop');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const escrowId = 1;
    const milestoneId = 1;
    
    console.log('🔄 Running agent decision cycle...\n');
    
    // Step 1: Check if milestone should be approved
    console.log('Step 1: Scanning attestations...');
    const attestationScore = 85; // Simulated
    console.log(`        Attestation score: ${attestationScore}% ✅\n`);
    
    // Step 2: Approve milestone
    if (attestationScore > 50) {
      console.log('Step 2: Approving milestone...');
      const approvalResult = await approveMilestone(milestoneId);
      if (!approvalResult.confirming) {
        console.log('        ✅ Milestone approved\n');
      }
    }
    
    // Step 3: Check idle balance
    console.log('Step 3: Checking idle balance...');
    const idleBalance = 150000000; // 150 USDC
    console.log(`        Idle: 150 USDC ✅\n`);
    
    // Step 4: Deploy to yield
    if (idleBalance > 100000000) { // > 100 USDC
      console.log('Step 4: Deploying idle funds to yield...');
      const deployResult = await deployYield(escrowId, '100000000');
      if (!deployResult.confirming) {
        console.log('        ✅ Deployed 100 USDC to yield\n');
      }
    }
    
    // Step 5: Summary
    console.log('\n📊 Cycle Summary:');
    console.log('   ✅ Attestation check passed');
    console.log('   ✅ Milestone approved');
    console.log('   ✅ Idle funds deployed to yield');
    console.log('   ✅ System ready for next cycle\n');
    
  } catch (error) {
    console.error(`❌ Decision loop failed: ${error.message}`);
  }
}

/**
 * Integration Guide: How to use in your agent
 */
function integrationGuide() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Integration Guide: Using Agentic Wallet in Your Agent');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`
// In your agent service (e.g., decision-engine.js):

import { approveMilestone, slashFounder, deployYield } from './agent-executor.js';

export async function runDecisionEngineCycle(escrowId) {
  // 1. Run attestation
  const attest = await runAttestation();
  
  // 2. If threshold met, approve milestone
  if (attest.passCount >= 50) {
    console.log('✅ Approval threshold reached');
    
    // This works with EITHER agentic wallet OR private key!
    // Just change USE_AGENTIC_WALLET in .env
    const result = await approveMilestone(milestoneId);
    
    if (result.confirming) {
      // High-risk tx - needs user confirmation
      console.log(result.message);
      // await userApproval() before retrying with force=true
    }
  }
  
  // 3. Deploy idle funds
  const idle = await getIdleBalance(escrowId);
  if (idle > threshold) {
    await deployYield(escrowId, idle);
  }
  
  // 4. Detect & slash no-shows
  const noshow = await detectNoShowFounder(escrowId);
  if (noshow) {
    await slashFounder(escrowId, 'No-show detected');
  }
}

// Deploy this to production:
// - USE_AGENTIC_WALLET=true in .env
// - Agent wallet funded with OKB
// - Agent registered with AgentManager.setAgent()
// - Then just run: npm run agent:daemon
  `);
}

// ─── Main Entry Point ─────────────────────────────────────────────────────
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   OKX Agentic Wallet Usage Examples                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Show which mode is active
  const mode = process.env.USE_AGENTIC_WALLET === 'true' ? 
    'OKX Agentic Wallet 🌟' : 
    'Private Key Signing 🔑';
  console.log(`\nMode: ${mode}`);
  console.log(`Escrow: ${ESCROW_ADDRESS}\n`);

  // Run examples
  await exampleApproveMilestone();
  await exampleSlashFounder();
  await exampleDeployYield();
  await exampleWithdrawYield();
  await exampleFullDecisionLoop();
  
  // Show integration guide
  integrationGuide();

  console.log('\n✨ Examples complete! See agent-executor.js for the full API.\n');
}

main().catch(console.error);
