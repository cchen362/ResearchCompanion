#!/bin/bash

# Deploy Safeguards Script
# Prevents common deployment issues that can break the production app

echo "🔒 Running deployment safeguards..."

# 1. Check if running in Git Bash on Windows (can cause path conversion issues)
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  echo "⚠️  WARNING: Detected Git Bash on Windows"
  echo "   Git Bash can convert paths like /api to C:/Program Files/Git/api"
  echo "   Consider using:"
  echo "   - PowerShell or CMD on Windows"
  echo "   - Building directly on Linux server"
  echo "   - Setting: export MSYS_NO_PATHCONV=1"
  read -p "   Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 2. Check for local dist folder (can contaminate Docker build)
if [ -d "dist" ]; then
  echo "⚠️  WARNING: Local dist folder exists"
  echo "   This can contaminate the Docker build with wrong paths"
  read -p "   Delete dist folder before building? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    rm -rf dist
    echo "   ✅ Deleted dist folder"
  fi
fi

# 3. Check for local assets folder
if [ -d "assets" ]; then
  echo "⚠️  WARNING: Local assets folder exists"
  echo "   This can contaminate the Docker build"
  read -p "   Delete assets folder before building? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    rm -rf assets
    echo "   ✅ Deleted assets folder"
  fi
fi

# 4. Check if index.html has been modified with built content
if grep -q "crossorigin src=\"/assets/" index.html 2>/dev/null; then
  echo "⚠️  WARNING: index.html contains built asset references"
  echo "   This should be the source file, not built output"
  read -p "   Reset index.html to source version? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    git checkout -- index.html
    echo "   ✅ Reset index.html to source version"
  fi
fi

# 5. Verify .dockerignore includes necessary exclusions
echo "📋 Checking .dockerignore..."
MISSING_IGNORES=()

if ! grep -q "^dist$" .dockerignore 2>/dev/null; then
  MISSING_IGNORES+=("dist")
fi

if ! grep -q "^assets" .dockerignore 2>/dev/null; then
  MISSING_IGNORES+=("assets/")
fi

if [ ${#MISSING_IGNORES[@]} -gt 0 ]; then
  echo "⚠️  WARNING: .dockerignore is missing important exclusions:"
  for ignore in "${MISSING_IGNORES[@]}"; do
    echo "   - $ignore"
  done
  read -p "   Add missing exclusions to .dockerignore? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    for ignore in "${MISSING_IGNORES[@]}"; do
      echo "$ignore" >> .dockerignore
    done
    echo "   ✅ Updated .dockerignore"
  fi
fi

# 6. Set environment variable to prevent Git Bash path conversion
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  export MSYS_NO_PATHCONV=1
  echo "✅ Set MSYS_NO_PATHCONV=1 to prevent path conversion"
fi

# 7. Verification function to run after build
verify_build() {
  echo "🔍 Verifying build output..."

  # Check if container is running
  if docker ps | grep -q medical-companion; then
    # Check API URL in production bundle
    API_URL=$(docker exec medical-companion sh -c 'grep -o "VITE_API_BASE_URL:[^,]*" /usr/share/nginx/html/assets/index-*.js 2>/dev/null | head -1')

    if [[ $API_URL == *"C:/Program"* ]]; then
      echo "❌ ERROR: Production bundle contains Windows path!"
      echo "   Found: $API_URL"
      echo "   Expected: VITE_API_BASE_URL:\"/api\""
      echo ""
      echo "   This build is corrupted and will cause login failures."
      echo "   Please rebuild on a Linux server."
      return 1
    elif [[ $API_URL == *'"/api"'* ]]; then
      echo "✅ Production bundle has correct API URL: $API_URL"
      return 0
    else
      echo "⚠️  Could not verify API URL in production bundle"
      echo "   Found: $API_URL"
      return 2
    fi
  else
    echo "⚠️  Container not running, cannot verify build"
    return 2
  fi
}

echo ""
echo "✅ Safeguard checks complete!"
echo ""
echo "📦 Ready to build. Use these commands:"
echo "   docker-compose build --no-cache medical-companion"
echo "   docker-compose up -d"
echo ""
echo "🔍 After deployment, verify with:"
echo "   source deploy-safeguards.sh && verify_build"
echo ""

# Export the verify function so it can be used after build
export -f verify_build