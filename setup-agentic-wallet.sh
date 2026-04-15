#!/bin/bash
# setup-agentic-wallet.sh
# One-step setup script for OKX agentic wallet with SENTIX agent

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    SENTIX OKX Agentic Wallet Setup Script                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if onchainos is installed
if ! command -v onchainos &> /dev/null; then
    echo "❌ ERROR: onchainos CLI not found"
    echo ""
    echo "Install OKX CLI from: https://web3.okx.com/onchainos/docs"
    echo "Then run: npm install -g @okxweb3/agentic-cli"
    exit 1
fi

echo "✅ onchainos CLI found"
echo ""

# Step 1: Check login status
echo "📋 Step 1: Checking login status..."
if onchainos wallet status > /dev/null 2>&1; then
    STATUS=$(onchainos wallet status --json 2>/dev/null || echo "{}")
    LOGGED_IN=$(echo "$STATUS" | jq -r '.loggedIn // false' 2>/dev/null || echo "false")
    
    if [ "$LOGGED_IN" = "true" ]; then
        EMAIL=$(echo "$STATUS" | jq -r '.email // "unknown"' 2>/dev/null)
        echo "✅ Already logged in as: $EMAIL"
    else
        echo "❌ Not logged in"
        read -p "Enter your email: " EMAIL
        echo ""
        echo "🔐 Logging in with email: $EMAIL"
        onchainos wallet login "$EMAIL" --locale en-US
        echo ""
        read -p "Enter verification code from your email: " VERIFY_CODE
        onchainos wallet verify "$VERIFY_CODE"
    fi
else
    echo "⚠️  First time login required"
    read -p "Enter your email: " EMAIL
    onchainos wallet login "$EMAIL" --locale en-US
    echo ""
    read -p "Enter verification code: " VERIFY_CODE
    onchainos wallet verify "$VERIFY_CODE"
fi

echo ""
echo "✅ Wallet authentication complete"
echo ""

# Step 2: Get wallet addresses
echo "📋 Step 2: Retrieving wallet address..."
ADDRESSES=$(onchainos wallet addresses --json)
WALLET_ADDRESS=$(echo "$ADDRESSES" | jq -r '.addressData[0].address' 2>/dev/null)

if [ -z "$WALLET_ADDRESS" ] || [ "$WALLET_ADDRESS" = "null" ]; then
    echo "❌ Failed to get wallet address"
    exit 1
fi

echo "✅ Wallet address: $WALLET_ADDRESS"
echo ""

# Step 3: Check balance
echo "📋 Step 3: Checking OKB balance..."
BALANCE=$(onchainos wallet balance --chain xlayer --json 2>/dev/null || echo "{}")
OKB_BALANCE=$(echo "$BALANCE" | jq -r '.tokenDetails[]? | select(.tokenSymbol == "OKB") | .amount' 2>/dev/null)

if [ -z "$OKB_BALANCE" ]; then
    echo "⚠️  No OKB balance detected"
    echo ""
    echo "📌 Next steps to fund wallet:"
    echo "   1. Go to: https://web3.okx.com"
    echo "   2. Log in and navigate to: Wallet → Receive"
    echo "   3. Copy your address and use OKX Exchange to send OKB:"
    echo "   4. Exchange → Withdraw → OKB → Paste address above"
    echo ""
    read -p "Press Enter after funding the wallet..."
    
    # Re-check balance
    BALANCE=$(onchainos wallet balance --chain xlayer --json 2>/dev/null)
    OKB_BALANCE=$(echo "$BALANCE" | jq -r '.tokenDetails[]? | select(.tokenSymbol == "OKB") | .amount' 2>/dev/null || echo "0")
fi

echo "✅ OKB Balance: ${OKB_BALANCE:-0.00}"
echo ""

# Step 4: Update .env
echo "📋 Step 4: Updating .env configuration..."
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example "$ENV_FILE"
    else
        echo "❌ .env.example not found"
        exit 1
    fi
fi

# Update .env with agentic wallet settings
sed -i.bak "s/^USE_AGENTIC_WALLET=.*/USE_AGENTIC_WALLET=true/" "$ENV_FILE" || \
  echo "USE_AGENTIC_WALLET=true" >> "$ENV_FILE"

sed -i.bak "s/^AGENT_ADDRESS=.*/AGENT_ADDRESS=$WALLET_ADDRESS/" "$ENV_FILE" || \
  echo "AGENT_ADDRESS=$WALLET_ADDRESS" >> "$ENV_FILE"

echo "✅ Updated .env"
echo "   USE_AGENTIC_WALLET=true"
echo "   AGENT_ADDRESS=$WALLET_ADDRESS"
echo ""

# Step 5: Inform about contract registration
echo "📋 Step 5: Contract Registration"
echo "   ⚠️  IMPORTANT: Contract owner must register this wallet as agent"
echo ""
echo "   The owner should call:"
echo "   AgentManager.setAgent('$WALLET_ADDRESS')"
echo ""
echo "   Or via Ethers.js:"
echo "   const agentManager = new ethers.Contract(AGENT_MANAGER_ADDRESS, ABI, ownerSigner);"
echo "   await agentManager.setAgent('$WALLET_ADDRESS');"
echo ""
read -p "Press Enter after contract owner registers the wallet..."
echo ""

# Step 6: Test the setup
echo "📋 Step 6: Testing setup..."
npm run test:agentic-wallet

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! ✨                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 Your agentic wallet is ready to interact with Escrow!"
echo ""
echo "Next steps:"
echo "  1. Ensure contract owner has registered the wallet"
echo "  2. Run: npm run agent:once"
echo "  3. Monitor: npm run agent:daemon"
echo ""
echo "📚 Documentation: agent/agentic-wallet-setup.md"
echo ""
