#!/bin/bash

# Medical Companion PWA - Production Deployment Script
# Usage: ./deploy.sh [--skip-backup] [--no-cache]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="chee"
SERVER_HOST="100.94.82.35"
APP_DIR="/home/chee/medical-pwa"
SKIP_BACKUP=false
NO_CACHE=false
BRANCH="fix/digest-findings-race-condition"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --no-cache)
      NO_CACHE=true
      shift
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-backup] [--no-cache] [--branch branch-name]"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}Medical Companion PWA Deployment${NC}"
echo -e "${GREEN}=======================================${NC}"
echo "Server: ${SERVER_USER}@${SERVER_HOST}"
echo "Branch: ${BRANCH}"
echo ""

# Function to run commands on server
run_remote() {
  ssh "${SERVER_USER}@${SERVER_HOST}" "$@"
}

# Step 1: Check connectivity
echo -e "\n${YELLOW}[1/10] Checking server connectivity...${NC}"
if run_remote "echo 'Connected successfully'"; then
  echo -e "${GREEN}✅ Server connection established${NC}"
else
  echo -e "${RED}❌ Failed to connect to server${NC}"
  exit 1
fi

# Step 2: Backup current state (optional)
if [ "$SKIP_BACKUP" = false ]; then
  echo -e "\n${YELLOW}[2/10] Creating backup...${NC}"
  BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"

  run_remote "cd ${APP_DIR} && mkdir -p backups/${BACKUP_NAME}"

  # Backup docker state
  run_remote "cd ${APP_DIR} && docker-compose ps > backups/${BACKUP_NAME}/container_status.txt 2>&1 || true"

  # Backup database
  run_remote "cd ${APP_DIR} && docker-compose exec -T postgres pg_dump -U postgres medical_companion > backups/${BACKUP_NAME}/database.sql 2>&1 || echo 'Database backup skipped'"

  echo -e "${GREEN}✅ Backup created: ${BACKUP_NAME}${NC}"
else
  echo -e "\n${YELLOW}[2/10] Skipping backup (--skip-backup flag)${NC}"
fi

# Step 3: Pull latest code
echo -e "\n${YELLOW}[3/10] Pulling latest code...${NC}"
run_remote "cd ${APP_DIR} && git fetch origin"
run_remote "cd ${APP_DIR} && git checkout ${BRANCH}"
run_remote "cd ${APP_DIR} && git pull origin ${BRANCH}"
CURRENT_COMMIT=$(run_remote "cd ${APP_DIR} && git rev-parse --short HEAD")
echo -e "${GREEN}✅ Code updated to commit: ${CURRENT_COMMIT}${NC}"

# Step 4: Stop containers
echo -e "\n${YELLOW}[4/10] Stopping containers...${NC}"
run_remote "cd ${APP_DIR} && docker-compose down"
echo -e "${GREEN}✅ Containers stopped${NC}"

# Step 5: Clean old images
echo -e "\n${YELLOW}[5/10] Cleaning old images...${NC}"
run_remote "cd ${APP_DIR} && docker-compose rm -f"
run_remote "cd ${APP_DIR} && docker rmi medical-pwa_medical-companion 2>/dev/null || true"
run_remote "cd ${APP_DIR} && docker image prune -f"
echo -e "${GREEN}✅ Old images removed${NC}"

# Step 6: Set build metadata
echo -e "\n${YELLOW}[6/10] Setting build metadata...${NC}"
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
run_remote "cd ${APP_DIR} && export BUILD_TIME='${BUILD_TIME}' && export GIT_COMMIT='${CURRENT_COMMIT}'"

# Step 7: Rebuild containers
echo -e "\n${YELLOW}[7/10] Rebuilding containers...${NC}"
if [ "$NO_CACHE" = true ]; then
  echo "Building with --no-cache flag..."
  run_remote "cd ${APP_DIR} && BUILD_TIME='${BUILD_TIME}' GIT_COMMIT='${CURRENT_COMMIT}' docker-compose build --no-cache"
else
  run_remote "cd ${APP_DIR} && BUILD_TIME='${BUILD_TIME}' GIT_COMMIT='${CURRENT_COMMIT}' docker-compose build"
fi
echo -e "${GREEN}✅ Containers rebuilt${NC}"

# Step 8: Start containers
echo -e "\n${YELLOW}[8/10] Starting containers...${NC}"
run_remote "cd ${APP_DIR} && docker-compose up -d"
echo -e "${GREEN}✅ Containers started${NC}"

# Step 9: Wait for health checks
echo -e "\n${YELLOW}[9/10] Waiting for containers to be healthy...${NC}"
sleep 10

MAX_WAIT=60
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  UNHEALTHY=$(run_remote "cd ${APP_DIR} && docker-compose ps | grep -i 'unhealthy' || true")
  if [ -z "$UNHEALTHY" ]; then
    echo -e "${GREEN}✅ All containers healthy${NC}"
    break
  fi
  echo "Waiting for containers to become healthy... ($ELAPSED/$MAX_WAIT seconds)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo -e "${YELLOW}⚠️  Warning: Some containers may not be healthy${NC}"
  run_remote "cd ${APP_DIR} && docker-compose ps"
fi

# Step 10: Verify deployment
echo -e "\n${YELLOW}[10/10] Verifying deployment...${NC}"

# Check backend health
HEALTH_CHECK=$(run_remote "curl -s http://localhost:3001/api/health 2>/dev/null || echo 'FAILED'")
if [[ $HEALTH_CHECK == *"healthy"* ]]; then
  echo -e "${GREEN}✅ Backend health check passed${NC}"
else
  echo -e "${RED}❌ Backend health check failed${NC}"
  echo "Response: $HEALTH_CHECK"
fi

# Check version endpoint
VERSION_CHECK=$(run_remote "curl -s http://localhost:3001/api/version 2>/dev/null || echo 'FAILED'")
if [[ $VERSION_CHECK == *"gitCommit"* ]]; then
  echo -e "${GREEN}✅ Version endpoint working${NC}"
  echo "Version info: $VERSION_CHECK"
else
  echo -e "${YELLOW}⚠️  Version endpoint not responding${NC}"
fi

# Check frontend bundle
BUNDLE_HASH=$(run_remote "curl -s http://localhost:6767/ 2>/dev/null | grep -o 'index-[a-zA-Z0-9]*.js' | head -1 || echo 'NOT_FOUND'")
if [ "$BUNDLE_HASH" != "NOT_FOUND" ]; then
  echo -e "${GREEN}✅ Frontend bundle: $BUNDLE_HASH${NC}"
else
  echo -e "${RED}❌ Frontend bundle not found${NC}"
fi

# Display summary
echo -e "\n${GREEN}=======================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}=======================================${NC}"
echo -e "Commit:  ${CURRENT_COMMIT}"
echo -e "Time:    $(date)"
echo -e "Bundle:  ${BUNDLE_HASH}"
echo -e "Branch:  ${BRANCH}"
echo -e "${GREEN}=======================================${NC}"

# Final status
if [[ $HEALTH_CHECK == *"healthy"* ]] && [ "$BUNDLE_HASH" != "NOT_FOUND" ]; then
  echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
  echo -e "\nNext steps:"
  echo -e "1. Test the application at https://cl.zyroi.com"
  echo -e "2. Monitor logs: ssh ${SERVER_USER}@${SERVER_HOST} 'cd ${APP_DIR} && docker-compose logs -f'"
  echo -e "3. Check health: curl https://cl.zyroi.com/api/health"
  exit 0
else
  echo -e "\n${RED}⚠️  Deployment completed with warnings${NC}"
  echo -e "Please check the logs for more details"
  exit 1
fi