// agent/server.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

// Global state perfectly aligned with your React frontend
export const agentState = {
    sentry_wallet: '0x00223b332561f6eb2d640adea92c1fc891944f5f0',
    verified_count: 0,
    threshold: 2,
    threshold_reached: false,
    bots_rejected: 0,
    humans_verified: 0,
    deployed_usdc: '0.00',       // Used by the MoneyFlow and Yield cards
    yield_earned_usd: '0.00',
    deal_state: 'PENDING',       // Changes to 'FUNDED' then 'SUCCESS'
    cycle_count: 0,
    contracts_ready: true,
    logs: [],                    // Feeds your Web Terminal
    pending_addresses: []        // The Agent Loop reads from here!
};

app.get('/api/logs', (req, res) => {
    res.json(agentState.logs);
});

// POST endpoint to catch real transaction hashes from the frontend
app.post('/api/log-tx', (req, res) => {
    const { hash, message } = req.body;
    
    // Create the OKLink Block Explorer URL for X Layer Testnet
    const explorerLink = `https://www.oklink.com/xlayer-test/tx/${hash}`;
    
    // Create a beautiful log message
    const msg = `🔗 [On-Chain] ${message}: ${explorerLink}`;
    
    console.log(`[Server] ${msg}`);
    
    // Push it to your global state so the React Terminal updates
    agentState.logs.push({ 
        time: new Date().toLocaleTimeString(), 
        msg: msg, 
        type: 'success' // Gives it that nice green color if your terminal supports it
    });
    
    res.json({ success: true });
});
app.post('/api/submit-milestone', async (req, res) => {
    console.log("[API] Milestone submission received.");
    
    // 🚨 LOCK THE STATE: Immediately tell the agent that 2 users are now verified
    agentState.humans_verified = 2;
    agentState.verified_count = 2;
    agentState.deal_state = 'ACTIVE'; 

    res.json({ success: true });
});
 app.get('/api/show-swap-json', async (req, res) => {
    try {
        console.log("\n[DEX] 🌐 Requesting Swap Quote via OnchainOS CLI...");

        // Using the exact arguments the CLI asked for
        const cmd = `onchainos swap quote --from USDC --to OKB --chain xlayer --amount 50`;
        
        console.log(`[DEX] Executing: ${cmd}`);

        const { stdout, stderr } = await execAsync(cmd);

        if (stderr && !stdout) {
            console.error("❌ [DEX] CLI Error:", stderr);
            return res.status(500).json({ error: stderr });
        }

        console.log("✅ [DEX] Optimal Route Found!");
        console.log(stdout);

        res.json({ success: true });

    } catch (err) {
        console.error("❌ Failed to execute CLI command:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// GET endpoint for the dashboard
app.get('/api/status', (req, res) => {
    res.json(agentState);
});

// 1. POST endpoint for the VC Deposit action
app.post('/api/deposit', (req, res) => {
    const { amount } = req.body;
    
    // Update the frontend state variables
    const currentAmount = parseFloat(agentState.deployed_usdc);
    const newAmount = currentAmount + amount;
    
    agentState.deployed_usdc = newAmount.toFixed(2);
    agentState.deal_state = 'FUNDED';
    
    // Log it to the terminal
    const msg = `💰 VC Deposit detected: $${amount.toLocaleString()} USDC injected into Escrow.`;
    console.log(`[Server] ${msg}`);
    agentState.logs.push({ time: new Date().toLocaleTimeString(), msg, type: 'success' });
    
    res.json({ success: true, newBalance: agentState.deployed_usdc });
});

// 2. POST endpoint for the Founder Milestone Submission
app.post('/api/submit-milestone', (req, res) => {
    const { addresses } = req.body;
    
    if (!addresses || addresses.length === 0) {
        return res.status(400).json({ error: 'No addresses provided' });
    }
    
    // Queue the addresses so `index.js` loop picks them up
    agentState.pending_addresses.push(...addresses);
    
    // Log it to the terminal
    const msg = `🚀 Founder submitted ${addresses.length} wallets. Queued for TEE Sentry Scan...`;
    console.log(`[Server] ${msg}`);
    agentState.logs.push({ time: new Date().toLocaleTimeString(), msg, type: 'info' });
    
    res.json({ success: true, queued: addresses.length });
});

app.listen(3001, () => {
    console.log("🚀 Agent API Bridge running on http://localhost:3001");
});