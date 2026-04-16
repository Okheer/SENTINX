# 🛡️ X-Sentry (formerly SENTINX)
**Autonomous Agentic Escrow & Treasury Manager built on X Layer.**

> *"Most escrows are like a dusty safe in a basement. X-Sentry is like a high-frequency fund manager with a security detail, ensuring capital stays productive and payouts stay honest."*

---

## 🚀 What We Built & The Problem It Solves

Decentralized venture capital and milestone-based funding currently suffer from three critical bottlenecks:
1. **Idle Capital (The Opportunity Cost):** VCs lock funds into escrow smart contracts where they sit completely unproductive for months.
2. **Sybil Attacks (The Fraud Risk):** Founders can easily "game" milestone metrics by spinning up hundreds of burner wallets to fake user growth.
3. **Manual Bottlenecks (The Trust Gap):** Milestone verification relies on human auditing, which is slow, biased, and requires the VC to manually authorize transactions.

**X-Sentry solves this by replacing the passive smart contract with an Autonomous Agentic Wallet.** Instead of waiting for a human to click a button, X-Sentry deploys an AI agent inside a hardware-secured Trusted Execution Environment (TEE). This agent actively monitors the escrow, autonomously farms yield on the OKX DEX while funds are waiting, and uses complex on-chain diversity scanning to cryptographically verify human users before releasing funds. 

---

## 🛠️ The Tech Stack

We carefully selected our stack to bridge high-performance execution with hardware-grade security:

### Core Infrastructure
* **X Layer (Blockchain):** Provides the high-throughput, low-gas environment required for the Agent to frequently poll states, rebalance yield, and execute micro-transactions without draining the treasury.
* **OKX DEX & APIs:** Serves as the primary liquidity router for the Agent’s autonomous yield loop and provides the deep portfolio data needed for the Sybil-Shield scan.

### The Agentic Brain (OnchainOS)
* **`onchainos-cli` (TEE Executor):** Wraps the AI's decision-making in a Trusted Execution Environment. The private keys and payout logic are shielded in a "black box," ensuring the agent is tamper-proof.
* **`onchainos-wallet` & `onchainos-core`:** Transforms a standard wallet into a programmable Agentic Wallet that manages its own nonces, estimates gas, and pushes payloads to the blockchain autonomously.
* **`onchainos-plugin-web3`:** Enables the agent to construct exact multi-hop calldata for Phase 1 swaps with minimal slippage.

### Frontend & Backend
* **Backend (Decision Engine):** Node.js and Ethers.js (v6).
* **Frontend (God-View Dashboard):** React.js, implementing Optimistic UI for a lightning-fast demonstration of the Agent's real-time terminal logs and state changes.

---

## ⚙️ The Technical Workflow

X-Sentry operates in a strict, zero-human-touch 3-Phase loop:

### Phase 1: Autonomous Deployment (Idle Capital -> Yield)
1. **Trigger:** The VC injects USDC into the `Escrow.sol` smart contract.
2. **Action:** The Sentry Agent detects the state change via the `onchainos-core` polling mechanism.
3. **Execution:** Instead of letting the capital sit, the Agent generates payload calldata via the OKX router and securely signs a transaction inside the TEE to swap the USDC for yield-bearing assets (e.g., WETH). 

### Phase 2: Verification (The Sybil-Shield)
1. **Trigger:** The Founder submits wallet addresses claiming they have hit their "Active User" milestone.
2. **Action:** The Sentry Agent intercepts these addresses and runs a multi-dimensional **Diversity Scan**. 
3. **Execution:** Using OKX APIs, it analyzes account age, transaction history, and token diversity. It calculates a "Sybil-Proof Score" to separate genuine human users from bot networks.

### Phase 3: Settlement (Payout Authorization)
1. **Trigger:** The Sybil-Proof score surpasses the required threshold (e.g., 2/2 Verified Humans).
2. **Action:** The Decision Engine authorizes the payout.
3. **Execution:** The Agent autonomously formulates the transaction to unwind the DEX yield, converts it back to stablecoins, and calls `executeAgentAction()` on the smart contract to release the funds directly to the Founder's wallet. The final state is reached entirely on-chain.

---

## 💻 Getting Started (Local Setup)

Follow these steps to run the complete X-Sentry simulation, including the React Frontend Dashboard and the Node.js Agentic Backend.

### Prerequisites
* **Node.js** (v18+)
* **npm** or **yarn**
* **OKX Wallet** browser extension (Configured for X Layer Testnet)

### 1. Clone & Install
Open your terminal and run the following:

```bash
# Clone the repository
git clone [https://github.com/your-username/x-sentry.git](https://github.com/your-username/x-sentry.git)
cd x-sentry

# Install frontend dependencies
npm install

# Install backend agent dependencies
cd agent
npm install
cd ..
```

### 2. Environment Configuration
Create two `.env` files—one in the root directory and one inside the `/agent` folder.

**`agent/.env` (Backend Configuration):**
```env
# Network Configuration
RPC_URL=[https://testrpc.xlayer.tech](https://testrpc.xlayer.tech)
CHAIN_ID=1952

# X Layer Testnet Contract Addresses
SENTINX_ESCROW_ADDRESS=0xYourEscrowContractAddress
MOCK_YIELD_ADDRESS=0xYourMockYieldRouterAddress

# Agentic Wallet Configuration
SENTRY_ADDRESS=0xYourAgentWalletAddress
SENTRY_PRIVATE_KEY=your_private_key_here 

# API Keys
OKX_API_KEY=your_okx_api_key_here
```

### 3. Start the Simulation
You will need two terminal windows open to run the full stack simultaneously.

**Terminal 1: Start the Backend Agent**
```bash
cd agent
node index.js
# Expected output: "[Sentry] Agent Node Started. Listening on port 3001"
```

**Terminal 2: Start the Frontend Dashboard**
```bash
# From the root directory
npm run dev
# The application will launch at http://localhost:3000
```

### 4. Running the Demo Flow
1. Open `http://localhost:3000`.
2. As a **VC**, click **Inject Capital** to simulate the escrow deposit. Watch the Web Terminal log the Agent's autonomous DEX swap.
3. Switch to the **Founder** tab, input test wallet addresses, and click **Submit Wallets & Unlock Milestone**.
4. The frontend will instantaneously show the verified users via Optimistic UI, while the terminal proves the cryptographic verification and yield-unwinding process happening in the background!
5. 
