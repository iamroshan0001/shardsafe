#!/bin/bash
# ShardSafe EC2 Setup Script
# Run this on a fresh Ubuntu 24.04 EC2 instance

set -e

echo "=========================================="
echo "  ShardSafe EC2 Setup Script"
echo "=========================================="

# Update system
echo "[1/7] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Node.js 20
echo "[2/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version

# Install PM2 globally
echo "[3/7] Installing PM2..."
sudo npm install -g pm2

# Install git
echo "[4/7] Installing git..."
sudo apt-get install -y git

# Create app directory
echo "[5/7] Setting up app directory..."
mkdir -p ~/shardsafe/backend

echo "=========================================="
echo "  Setup complete!"
echo "  Next steps:"
echo "  1. Upload backend files using scp"
echo "  2. Create .env file"
echo "  3. Run: cd ~/shardsafe/backend && npm install && npm run build"
echo "  4. Run: pm2 start dist/index.js --name shardsafe-api"
echo "  5. Run: pm2 save && pm2 startup"
echo "=========================================="
