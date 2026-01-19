#!/bin/bash

# Citation Fix Deployment Script
# This script deploys the citation rendering fixes to production

echo "🚀 Starting deployment of citation fixes..."
echo "Server: 100.94.82.35"
echo "Directory: /home/debian/medical-pwa"
echo ""

# SSH and execute commands
ssh debian@100.94.82.35 << 'ENDSSH'
    set -e  # Exit on error

    echo "📂 Navigating to project directory..."
    cd /home/debian/medical-pwa

    echo "📥 Pulling latest changes..."
    git pull origin fix/digest-findings-race-condition

    echo "🔨 Building frontend..."
    npm install
    npm run build

    echo "🔨 Building backend..."
    cd backend
    npm install
    npm run build

    echo "🔄 Restarting services..."
    pm2 restart all

    echo "✅ Deployment complete!"
    echo ""
    echo "📊 PM2 Status:"
    pm2 status
ENDSSH

echo ""
echo "✨ Deployment script completed!"
echo "🌐 Please test the application at: https://cl.zyroi.com"
echo ""
echo "Testing steps:"
echo "1. Create or select a topic with 30+ findings"
echo "2. Send a chat message requesting a summary"
echo "3. Verify all citations appear as clickable blue buttons"
echo "4. Click citations to verify they open finding details"
echo "5. Check console for any errors"