# SENTINX — Sentry Agent (Person B)

Autonomous Sybil-detection and milestone verification agent
running on X Layer Testnet.

## What it does
1. Scans founder-submitted wallet addresses using OKX Onchain OS skills
2. Scores each wallet for diversity (unique tokens, tx count, account age)
3. Rejects Sybil bots — attests real users on-chain via IdentityRegistry.sol
4. Uploads IPFS evidence for every verified user
5. Triggers milestone release when 50 verified users reached
6. Manages yield on idle escrow capital via okx-dex-swap → Uniswap V3

## OKX Skills Used
- okx-wallet-portfolio  → token balances across 5 chains
- okx-dex-market        → DEX transaction history + account age
- okx-dex-swap          → yield deployment + liquidation via Uniswap V3

## Setup
cp .env.example .env
# Fill in values — see .env.example for what each key does
npm install
npm start

## API
POST /submit  { "addresses": ["0x..."] }   — queue addresses for scanning
GET  /status                                — returns live deal metrics

## Sybil Detection Rules
PASS if ALL three:
  unique_tokens  > 3
  total_tx_count > 10
  account_age    > 30 days

## Tests
npm test -- --forceExit