# Deployment Instructions - Digest Loading Fix

## Issue Being Fixed
The cached digest wasn't loading immediately when users navigate to the Findings page. Instead, they saw "Generate Digest" button while findings loaded, then the cached digest appeared afterward.

## Root Cause
1. **Code Issue**: Missing `digestLoading` state to track when digest is being fetched
2. **Deployment Issue**: Docker was using cached layers and not picking up code changes

## Files Changed
- `src/components/FindingsViewerEnhanced.tsx` - Added `digestLoading` state
- `Dockerfile` - Added verification step to ensure fix is present
- `deploy-clean.sh` - Script to force complete rebuild

## Deployment Steps

### Step 1: SSH into the server
```bash
ssh chee@100.94.82.35
```

### Step 2: Navigate to project directory
```bash
cd medical-pwa
```

### Step 3: Pull latest changes
```bash
git pull
```

### Step 4: Make deployment script executable
```bash
chmod +x deploy-clean.sh
```

### Step 5: Run clean deployment
```bash
./deploy-clean.sh
```

This script will:
1. Stop all containers
2. Remove old Docker images
3. Clear Docker build cache
4. Verify the fix is in the source code
5. Build with `--no-cache` flag to force complete rebuild
6. Start the containers
7. Show logs

### Step 6: Verify the fix

The build should show:
```
✓ Digest loading fix detected in source!
```

If you see an error message instead, the fix is not present in the code.

### Step 7: Test on production

1. Go to http://100.94.82.35:6767
2. Log in with test account
3. Navigate to Findings page with existing cached digest
4. You should see "Loading Digest..." message immediately
5. Cached digest should appear within 500ms
6. NO "Generate Digest" button should appear for cached digests

## Rollback Instructions

If something goes wrong:

```bash
# Stop containers
docker-compose down

# Checkout previous version
git checkout 09484a0

# Rebuild with previous version
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

## Important Notes

1. **Docker Caching**: Regular `docker-compose up --build` may use cached layers. Always use `--no-cache` for critical fixes.

2. **Verification**: The Dockerfile now includes a grep check to ensure the fix is present. The build will fail if the fix is missing.

3. **Clean Build**: The `deploy-clean.sh` script ensures a completely clean build by:
   - Removing old images
   - Pruning build cache
   - Using --no-cache flag

## Expected Behavior After Fix

### Before Fix:
1. User navigates to Findings page
2. Sees "Generate Digest" button
3. Findings load in console
4. Cached digest appears with "cached" indicator

### After Fix:
1. User navigates to Findings page
2. Sees "Loading Digest..." message immediately
3. Cached digest loads within 500ms
4. No unnecessary "Generate Digest" button for cached content

## Contact

If you encounter issues during deployment, check:
1. Docker logs: `docker-compose logs medical-companion`
2. Build output for the verification message
3. Browser console for any JavaScript errors

The fix has been tested locally and should work once properly deployed with a clean build.
