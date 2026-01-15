#!/bin/bash

# Medical Companion PWA - Start with PostgreSQL
# This script starts the application with PostgreSQL database support

echo "🚀 Starting Medical Companion PWA with PostgreSQL..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.docker..."
    cp .env.docker .env
    echo "⚠️  Please update the API keys in .env file with your actual keys!"
    echo ""
fi

# Start PostgreSQL container first
echo "🐘 Starting PostgreSQL database..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U meduser -d medcompanion > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""
echo "✅ PostgreSQL is ready!"
echo ""

# Build backend TypeScript
echo "🔨 Building backend..."
cd backend
npm run build
cd ..

# Start the full application
echo "🚀 Starting application..."
docker-compose up

echo ""
echo "✨ Application started!"
echo ""
echo "📱 Frontend: http://localhost:6767"
echo "🔌 Backend API: http://localhost:3001"
echo "🐘 PostgreSQL: localhost:5432"
echo ""
echo "To stop: Press Ctrl+C"