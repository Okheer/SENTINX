#!/bin/bash
# SENTINX Dashboard Quick Start

echo "========================================="
echo "  SENTINX Dashboard - Quick Start"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Navigate to dashboard directory
cd "$(dirname "$0")" || exit 1

echo "📦 Installing dependencies..."
npm install

echo ""
echo "========================================="
echo "  Installation Complete!"
echo "========================================="
echo ""
echo "Run the following commands:"
echo ""
echo "  Development server:"
echo "    npm run dev"
echo ""
echo "  Production build:"
echo "    npm run build"
echo ""
echo "  Preview production build:"
echo "    npm run preview"
echo ""
echo "========================================="
echo "  Dashboard will open at:"
echo "  http://localhost:5173"
echo "========================================="
echo ""
echo "💡 Make sure the SENTINX agent is running:"
echo "   cd ../agent && npm start"
echo ""
