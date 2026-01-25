#!/bin/bash

# Deploy script to fix cache issues on production server
# This script should be run on the server at 100.94.82.35

echo "====================================="
echo "Medical Companion PWA - Cache Fix Deployment"
echo "====================================="

# Navigate to project directory
cd /root/medical-companion-pwa || exit 1

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin fix/digest-findings-race-condition

# Stop current containers
echo "🛑 Stopping current containers..."
docker-compose down

# Build with no cache to ensure fresh build
echo "🏗️ Building new Docker image with cache fixes..."
docker build -t medical-companion-pwa:cache-fix --no-cache .

# Update docker-compose to use new image
echo "📝 Updating docker-compose.yml..."
sed -i 's|image: medical-companion-pwa:.*|image: medical-companion-pwa:cache-fix|' docker-compose.yml

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d

# Clear any CDN or proxy caches (if applicable)
echo "🧹 Clearing nginx cache..."
docker exec $(docker ps -qf "name=nginx") sh -c "rm -rf /var/cache/nginx/*"

# Force reload nginx to apply new cache headers
echo "♻️ Reloading nginx configuration..."
docker exec $(docker ps -qf "name=nginx") nginx -s reload

echo "====================================="
echo "✅ Deployment complete!"
echo "====================================="
echo ""
echo "IMPORTANT: Users need to:"
echo "1. Clear browser cache (Ctrl+Shift+Delete)"
echo "2. Or open the site in an incognito/private window"
echo "3. The service worker will auto-update within 24 hours"
echo ""
echo "New cache settings:"
echo "- JavaScript files: 1 hour cache with revalidation"
echo "- Service worker: Version bumped to v6-fix"
echo "- Service worker will not cache .js files anymore"