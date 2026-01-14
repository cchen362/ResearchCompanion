#!/bin/bash

# Medical Companion PWA Deployment Script
# For deployment on Debian server with Docker

set -e

echo "🚀 Medical Companion PWA Deployment Script"
echo "=========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Run: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    echo "Run: sudo apt-get install docker-compose"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."

    if [ -f .env.docker ]; then
        cp .env.docker .env
        echo "✅ Created .env from .env.docker"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env file and add your API keys before continuing!"
        echo "Required keys:"
        echo "  - ANTHROPIC_API_KEY"
        echo "  - OPENAI_API_KEY"
        echo "  - BRAVE_API_KEY"
        echo "  - JWT_SECRET (change the default!)"
        echo ""
        read -p "Have you updated the .env file with your keys? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Please update .env and run this script again."
            exit 1
        fi
    else
        echo "❌ .env.docker template not found. Please create .env file manually."
        exit 1
    fi
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Validate required environment variables
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
    echo "❌ ANTHROPIC_API_KEY not set in .env file"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo "❌ OPENAI_API_KEY not set in .env file"
    exit 1
fi

if [ -z "$BRAVE_API_KEY" ] || [ "$BRAVE_API_KEY" = "your_brave_api_key_here" ]; then
    echo "❌ BRAVE_API_KEY not set in .env file"
    exit 1
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random" ]; then
    echo "⚠️  WARNING: Using default JWT_SECRET. This is insecure!"
    read -p "Continue with default JWT_SECRET? (not recommended) (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please update JWT_SECRET in .env file."
        exit 1
    fi
fi

echo "✅ Environment variables validated"
echo ""

# Build or rebuild option
echo "Select deployment option:"
echo "1) Fresh deployment (build from scratch)"
echo "2) Update deployment (pull changes and rebuild)"
echo "3) Restart only (no rebuild)"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "🔨 Building fresh deployment..."
        docker-compose down -v 2>/dev/null || true
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    2)
        echo "🔄 Updating deployment..."
        docker-compose down
        git pull origin main 2>/dev/null || echo "Not a git repository, skipping pull"
        docker-compose build
        docker-compose up -d
        ;;
    3)
        echo "🔄 Restarting services..."
        docker-compose restart
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "Access your Medical Companion PWA at:"
    echo "  http://your-server-ip:6767"
    echo ""
    echo "First time setup:"
    echo "1. Navigate to http://your-server-ip:6767"
    echo "2. Click 'Create Account' to register"
    echo "3. Use the same login for multiple family members"
    echo ""
    echo "Useful commands:"
    echo "  docker-compose logs -f          # View logs"
    echo "  docker-compose ps               # Check status"
    echo "  docker-compose down             # Stop services"
    echo "  docker-compose restart          # Restart services"
    echo "  docker exec -it medical-companion /bin/sh  # Shell access"
else
    echo "❌ Services failed to start. Check logs with:"
    echo "  docker-compose logs"
    exit 1
fi