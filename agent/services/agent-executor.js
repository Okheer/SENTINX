// agent-executor.js
// Unified interface for agent to execute Escrow functions
// Supports both traditional private key signing and OKX agentic wallet

import { ethers } from 'ethers';
import {
  approveMilestone as agenticApproveMilestone,
  slashFounder as agenticSlashFounder,
  deployYield as agenticDeployYield,
  withdrawYield as agenticWithdrawYield,
  getAgenticWalletAddress,
  isWalletLoggedIn,
} from '../utils/agentic-wallet-utils.js';

// ─── Configuration ────────────────────────────────────────────────────────
const USE_AGENTIC_WALLET = process.env.USE_AGENTIC_WALLET === 'true';
const SENTRY_PRIVATE_KEY = process.env.SENTRY_PRIVATE_KEY;
const ESCROW_ADDRESS = process.env.SENTINX_ESCROW_ADDRESS;
const RPC_URL = process.env.RPC_URL || 'https://testrpc.xlayer.tech';

// ─── Traditional ethers.js approach (if not using agentic wallet) ────────
let _provider = null;
let _sentryWallet = null;

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return _provider;
}

function getSentryWallet() {
  if (!_sentryWallet && SENTRY_PRIVATE_KEY) {
    _sentryWallet = new ethers.Wallet(SENTRY_PRIVATE_KEY, getProvider());
  }
  return _sentryWallet;
}

const ESCROW_ABI = [
  'function approveMilestone(uint256 milestoneId) external',
  'function slashFounder(uint256 escrowId, string calldata reason) external',
  'function deployYield(uint256 escrowId, uint256 amount) external',
  'function withdrawYield(uint256 escrowId, uint256 amount) external',
];

// ─── Traditional approach: Direct contract call ────────────────────────
async function approveMilestoneTraditional(milestoneId) {
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, getSentryWallet());
  const tx = await escrow.approveMilestone(milestoneId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, success: receipt.status === 1 };
}

async function slashFounderTraditional(escrowId, reason) {
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, getSentryWallet());
  const tx = await escrow.slashFounder(escrowId, reason);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, success: receipt.status === 1 };
}

async function deployYieldTraditional(escrowId, amount) {
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, getSentryWallet());
  const tx = await escrow.deployYield(escrowId, amount);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, success: receipt.status === 1 };
}

async function withdrawYieldTraditional(escrowId, amount) {
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, getSentryWallet());
  const tx = await escrow.withdrawYield(escrowId, amount);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, success: receipt.status === 1 };
}

// ─── Public API: Dispatch to either agentic or traditional ────────────────

/**
 * Approve a milestone
 * Automatically uses agentic wallet if configured, else traditional signing
 */
export async function approveMilestone(milestoneId) {
  if (USE_AGENTIC_WALLET) {
    console.log(`[Agent] Using OKX agentic wallet to approve milestone ${milestoneId}`);
    return agenticApproveMilestone(ESCROW_ADDRESS, milestoneId, { chain: 'xlayer' });
  } else {
    console.log(`[Agent] Using private key to approve milestone ${milestoneId}`);
    return approveMilestoneTraditional(milestoneId);
  }
}

/**
 * Slash a founder
 * Automatically uses agentic wallet if configured, else traditional signing
 */
export async function slashFounder(escrowId, reason) {
  if (USE_AGENTIC_WALLET) {
    console.log(`[Agent] Using OKX agentic wallet to slash escrow ${escrowId}`);
    return agenticSlashFounder(ESCROW_ADDRESS, escrowId, reason, { chain: 'xlayer' });
  } else {
    console.log(`[Agent] Using private key to slash escrow ${escrowId}`);
    return slashFounderTraditional(escrowId, reason);
  }
}

/**
 * Deploy idle USDC to yield
 * Automatically uses agentic wallet if configured, else traditional signing
 */
export async function deployYield(escrowId, amount) {
  if (USE_AGENTIC_WALLET) {
    console.log(`[Agent] Using OKX agentic wallet to deploy yield ${amount} to escrow ${escrowId}`);
    return agenticDeployYield(ESCROW_ADDRESS, escrowId, amount, { chain: 'xlayer' });
  } else {
    console.log(`[Agent] Using private key to deploy yield ${amount} to escrow ${escrowId}`);
    return deployYieldTraditional(escrowId, amount);
  }
}

/**
 * Withdraw yield from investment
 * Automatically uses agentic wallet if configured, else traditional signing
 */
export async function withdrawYield(escrowId, amount) {
  if (USE_AGENTIC_WALLET) {
    console.log(`[Agent] Using OKX agentic wallet to withdraw yield ${amount} from escrow ${escrowId}`);
    return agenticWithdrawYield(ESCROW_ADDRESS, escrowId, amount, { chain: 'xlayer' });
  } else {
    console.log(`[Agent] Using private key to withdraw yield ${amount} from escrow ${escrowId}`);
    return withdrawYieldTraditional(escrowId, amount);
  }
}

/**
 * Get the agent wallet address
 * Returns the agentic wallet address if configured, else returns the private key wallet
 */
export async function getAgentAddress() {
  if (USE_AGENTIC_WALLET) {
    try {
      return await getAgenticWalletAddress();
    } catch (error) {
      console.error('Failed to get agentic wallet address:', error.message);
      throw error;
    }
  } else {
    const wallet = getSentryWallet();
    if (!wallet) throw new Error('SENTRY_PRIVATE_KEY not configured');
    return wallet.address;
  }
}

/**
 * Check if agent is properly configured
 */
export async function verifyConfiguration() {
  console.log('\n📋 Agent Configuration Check');
  console.log('═══════════════════════════════════════════════════════════');

  if (USE_AGENTIC_WALLET) {
    console.log('Mode: OKX Agentic Wallet ✨');
    const loggedIn = await isWalletLoggedIn();
    if (!loggedIn) {
      throw new Error('Agentic wallet not logged in. Run: onchainos wallet login <email>');
    }
    const address = await getAgenticWalletAddress();
    console.log(`Wallet: ${address}`);
  } else {
    console.log('Mode: Private Key Signing 🔑');
    const wallet = getSentryWallet();
    console.log(`Wallet: ${wallet.address}`);
  }

  console.log(`Escrow: ${ESCROW_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

export default {
  approveMilestone,
  slashFounder,
  deployYield,
  withdrawYield,
  getAgentAddress,
  verifyConfiguration,
};
