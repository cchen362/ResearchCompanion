#!/bin/bash
# Clean deployment script to force complete rebuild
# This ensures Docker doesn't use any cached layers

echo "🔄 Starting clean deployment with forced rebuild..."
echo "================================================"

# Step 1: Stop all containers
echo "📦 Stopping containers..."
docker-compose down

# Step 2: Remove old images to force rebuild
echo "🗑️ Removing old images..."
docker images | grep medical-companion | awk '{print $3}' | xargs -r docker rmi -f
docker images | grep medcompanion | awk '{print $3}' | xargs -r docker rmi -f

# Step 3: Prune build cache
echo "🧹 Pruning Docker build cache..."
docker builder prune -f

# Step 4: Pull latest code
echo "📥 Pulling latest code..."
git pull

# Step 5: Verify the fix is in the source
echo "✅ Verifying digest loading fix is present..."
if grep -q "digestLoading" src/components/FindingsViewerEnhanced.tsx; then
    echo "✓ Digest loading fix found in source!"
else
    echo "✗ ERROR: Digest loading fix NOT found in source!"
    echo "Please ensure the latest code has been pulled."
    exit 1
fi

# Step 6: Build with no cache
echo "🔨 Building with --no-cache flag..."
docker-compose build --no-cache

# Step 7: Start containers
echo "🚀 Starting containers..."
docker-compose up -d

# Step 8: Show logs
echo "📋 Showing logs (Ctrl+C to stop)..."
docker-compose logs -f