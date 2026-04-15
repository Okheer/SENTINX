// agentic-wallet-utils.js
// Utilities for OKX agentic wallet interactions with Escrow contract

import { execSync } from 'child_process';
import { ethers } from 'ethers';

// ─── Escrow ABI (minimal for calls) ───────────────────────────────────────
const ESCROW_ABI = [
  'function approveMilestone(uint256 milestoneId) external',
  'function slashFounder(uint256 escrowId, string calldata reason) external',
  'function deployYield(uint256 escrowId, uint256 amount) external',
  'function withdrawYield(uint256 escrowId, uint256 amount) external',
];

/**
 * Encodes the calldata for an Escrow function call
 * @param {string} functionName - Function name (e.g. 'approveMilestone')
 * @param {any[]} params - Function parameters
 * @returns {string} Hex-encoded calldata
 */
export function encodeEscrowCall(functionName, params) {
  const iface = new ethers.Interface(ESCROW_ABI);
  const calldata = iface.encodeFunctionData(functionName, params);
  return calldata;
}

/**
 * Calls an Escrow contract function via OKX agentic wallet
 * @param {string} escrowAddress - Escrow contract address
 * @param {string} functionName - Function to call (approveMilestone, slashFounder, etc)
 * @param {any[]} params - Function parameters
 * @param {object} options - Options: { chain, force, from, amount }
 * @returns {Promise<object>} Command execution result
 */
export async function callEscrowFunction(
  escrowAddress,
  functionName,
  params,
  options = {}
) {
  const {
    chain = 'xlayer',
    force = false,
    from = undefined,
    amount = '0', // no ETH sent by default
  } = options;

  // Validate function name
  const validFunctions = [
    'approveMilestone',
    'slashFounder',
    'deployYield',
    'withdrawYield',
  ];
  if (!validFunctions.includes(functionName)) {
    throw new Error(`Invalid function: ${functionName}`);
  }

  // Encode calldata
  const inputData = encodeEscrowCall(functionName, params);

  // Build onchainos command
  let cmd = `onchainos wallet contract-call \\
    --chain ${chain} \\
    --to ${escrowAddress} \\
    --input-data ${inputData}`;

  if (from) cmd += ` --from ${from}`;
  if (amount !== '0') cmd += ` --amt ${amount}`;
  if (force) cmd += ` --force`;

  try {
    console.log(`[Agentic Wallet] Calling ${functionName} on Escrow...`);
    const result = execSync(cmd, { encoding: 'utf8' });
    const parsedResult = JSON.parse(result);

    // Handle confirming response (needs user confirmation)
    if (parsedResult.confirming === true) {
      console.log(`⚠️  Confirmation needed:\n${parsedResult.message}`);
      console.log(`\nNext: ${parsedResult.next}`);
      
      // Return confirming state - caller should ask user
      return { confirming: true, message: parsedResult.message, next: parsedResult.next };
    }

    // Success
    if (parsedResult.txHash) {
      console.log(`✅ Transaction confirmed: ${parsedResult.txHash}`);
    }
    return parsedResult;
  } catch (error) {
    console.error(`❌ Agentic wallet call failed: ${error.message}`);
    throw error;
  }
}

/**
 * Gets the agentic wallet address from OKX
 * @returns {Promise<string>} Wallet address
 */
export async function getAgenticWalletAddress() {
  try {
    const result = execSync('onchainos wallet addresses', { encoding: 'utf8' });
    const parsed = JSON.parse(result);
    
    // OKX CLI returns structure: { ok: true, data: { xlayer: [...], evm: [...], solana: [...] } }
    const data = parsed.data || parsed;
    
    // Find X Layer (OKB native) address
    if (data.xlayer && Array.isArray(data.xlayer) && data.xlayer.length > 0) {
      return data.xlayer[0].address;
    }
    
    throw new Error('Could not find X Layer address in wallet');
  } catch (error) {
    console.error('Failed to get agentic wallet address:', error.message);
    throw error;
  }
}

/**
 * Checks if wallet is logged in
 * @returns {Promise<boolean>} True if logged in
 */
export async function isWalletLoggedIn() {
  try {
    const result = execSync('onchainos wallet status', { encoding: 'utf8' });
    const parsed = JSON.parse(result);
    
    // OKX CLI can return: { ok: true, data: { loggedIn: true } } or { loggedIn: true, ... }
    const loggedIn = parsed.data?.loggedIn !== undefined ? parsed.data.loggedIn : parsed.loggedIn;
    return loggedIn === true;
  } catch (error) {
    console.error('Wallet login check failed:', error.message);
    return false;
  }
}

/**
 * Gets wallet balance on a specific chain
 * @param {string} chain - Chain name (xlayer, ethereum, etc)
 * @param {string} tokenAddress - Token contract address (optional, if not specified returns all tokens)
 * @returns {Promise<object>} Balance info
 */
export async function getWalletBalance(chain = 'xlayer', tokenAddress = undefined) {
  try {
    let cmd = `onchainos wallet balance --chain ${chain}`;
    if (tokenAddress) cmd += ` --token-address ${tokenAddress}`;
    
    try {
      const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      return JSON.parse(result);
    } catch (execError) {
      // If command fails, try to get more details
      console.error(`  Command: ${cmd}`);
      console.error(`  Error: ${execError.message}`);
      
      // Try to extract stderr for more info
      if (execError.stderr) {
        console.error(`  Stderr: ${execError.stderr}`);
      }
      
      throw new Error(`Balance query failed on ${chain}. Check wallet login and X Layer testnet access.`);
    }
  } catch (error) {
    console.error(`Failed to get balance on ${chain}:`, error.message);
    throw error;
  }
}

/**
 * Approves a milestone (agent action)
 * @param {string} escrowAddress - Escrow contract address
 * @param {number|string} milestoneId - Milestone ID
 * @param {object} options - Options: { chain, force }
 */
export async function approveMilestone(escrowAddress, milestoneId, options = {}) {
  return callEscrowFunction(
    escrowAddress,
    'approveMilestone',
    [milestoneId],
    options
  );
}

/**
 * Slashes a founder for no-show
 * @param {string} escrowAddress - Escrow contract address
 * @param {number|string} escrowId - Escrow ID
 * @param {string} reason - Reason for slash
 * @param {object} options - Options: { chain, force }
 */
export async function slashFounder(
  escrowAddress,
  escrowId,
  reason,
  options = {}
) {
  return callEscrowFunction(
    escrowAddress,
    'slashFounder',
    [escrowId, reason],
    options
  );
}

/**
 * Deploys idle funds to yield
 * @param {string} escrowAddress - Escrow contract address
 * @param {number|string} escrowId - Escrow ID
 * @param {number|string} amount - Amount in token's minimal units
 * @param {object} options - Options: { chain, force }
 */
export async function deployYield(
  escrowAddress,
  escrowId,
  amount,
  options = {}
) {
  return callEscrowFunction(
    escrowAddress,
    'deployYield',
    [escrowId, amount],
    options
  );
}

/**
 * Withdraws yield from investment
 * @param {string} escrowAddress - Escrow contract address
 * @param {number|string} escrowId - Escrow ID
 * @param {number|string} amount - Amount in token's minimal units
 * @param {object} options - Options: { chain, force }
 */
export async function withdrawYield(
  escrowAddress,
  escrowId,
  amount,
  options = {}
) {
  return callEscrowFunction(
    escrowAddress,
    'withdrawYield',
    [escrowId, amount],
    options
  );
}

/**
 * Sends native tokens via agentic wallet
 * @param {string} recipient - Recipient address
 * @param {string} amount - Amount in human-readable form (e.g. "0.1" ETH)
 * @param {object} options - Options: { chain, force }
 */
export async function sendTokens(recipient, amount, options = {}) {
  const { chain = 'xlayer', force = false } = options;

  let cmd = `onchainos wallet send \\
    --chain ${chain} \\
    --recipient ${recipient} \\
    --readable-amount ${amount}`;

  if (force) cmd += ` --force`;

  try {
    console.log(`[Agentic Wallet] Sending ${amount} to ${recipient}...`);
    const result = execSync(cmd, { encoding: 'utf8' });
    const parsedResult = JSON.parse(result);

    if (parsedResult.confirming) {
      console.log(`⚠️  Confirmation:\n${parsedResult.message}`);
      return { confirming: true, message: parsedResult.message };
    }

    if (parsedResult.txHash) {
      console.log(`✅ Tx: ${parsedResult.txHash}`);
    }
    return parsedResult;
  } catch (error) {
    console.error(`❌ Send failed: ${error.message}`);
    throw error;
  }
}

export default {
  encodeEscrowCall,
  callEscrowFunction,
  getAgenticWalletAddress,
  isWalletLoggedIn,
  getWalletBalance,
  approveMilestone,
  slashFounder,
  deployYield,
  withdrawYield,
  sendTokens,
};
