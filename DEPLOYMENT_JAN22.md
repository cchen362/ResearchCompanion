# Production Deployment - January 22, 2026

## Deployment Details

### Initial Deployment
- **Time**: 09:12 UTC
- **Server**: 100.94.82.35:6767
- **Commit**: 94a7c45
- **Branch**: fix/digest-findings-race-condition
- **Container**: 9b922756af99
- **Status**: ✅ Successfully deployed

### Update Deployment - 504 Timeout Fix
- **Time**: 09:50 UTC
- **Container**: c00940364598
- **Status**: ✅ Successfully deployed
- **Critical Fix**: Reduced digest generation from 100→10 findings to prevent Cloudflare 504 timeouts

### Final Deployment - Database Connection Fix
- **Time**: 10:03 UTC
- **Container**: 738cd506837c
- **Status**: ✅ Successfully deployed
- **Critical Fix**: Fixed database connection for authentication
- **Network**: medical-pwa_medcompanion-network
- **Database**: PostgreSQL connected successfully

### Critical Cache Fix Deployment - January 26, 2026
- **Time**: Multiple attempts from Jan 24-26
- **Final Success**: January 26, 2026
- **Commit**: 97440ec
- **Status**: ✅ LOGIN NOW WORKING
- **Root Cause**: Nginx was caching JS files for 30 days with `immutable` directive
- **Impact**: Users couldn't login for days due to cached localhost:3001 references

## Critical Cache Issue Resolution

### The Problem That Persisted for Days
- Login attempts failed with CORS errors: `http://localhost:3001/auth/login`
- Multiple deployments and fixes didn't resolve the issue
- Environment variables were correctly fixed but had no effect
- Users reported "still running in circles" with same errors

### Root Cause Discovery
1. **Initial Investigation**: Found VITE_API_URL vs VITE_API_BASE_URL mismatch
2. **Fixed Environment Variables**: Corrected all .env files
3. **Still Failed**: Issue persisted despite correct configuration
4. **The Real Culprit**: nginx.conf had:
   ```nginx
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
       expires 30d;
       add_header Cache-Control "public, immutable";
   }
   ```
   - **30 days cache** for JavaScript files
   - **`immutable` directive** = browsers NEVER check for updates
   - Old cached JS with localhost:3001 served for up to 30 days!

### The Fix Applied
1. **nginx.conf**: Separated JS/CSS caching from images:
   ```nginx
   # Cache JavaScript and CSS with shorter TTL and revalidation
   location ~* \.(js|css)$ {
       expires 1h;
       add_header Cache-Control "public, must-revalidate";
   }
   ```
2. **Service Worker**: Bumped to `v6-fix` and excluded JS from caching
3. **Result**: Login now works at https://cl.zyroi.com ✅

## Fixes Deployed

### 1. Topic Deletion with Server Storage
- Frontend now properly delegates topic CRUD operations to server when `VITE_USE_SERVER_STORAGE=true`
- All topic operations (create, update, delete) now respect storage configuration
- PostgreSQL CASCADE DELETE properly removes all associated data

### 2. Chat State Management
- Fixed chat loading stale references after topic deletion
- Added topic change detection to clear invalid chat state
- Added event listener for 'topic-deleted' to synchronize UI
- Shows toast notification when current topic is deleted

### 3. Digest Auto-Generation
- Digest queue service initializes on app start via Dashboard component
- Added immediate queue processing after digest is queued (no 5-second wait)
- Component automatically triggers processing for pending digests
- Auto-queues digest when agent findings exist without digest

### 4. Digest Generation Optimization (UPDATED)
- **CRITICAL**: Reduced finding count from 100 to **10 findings** to prevent Cloudflare 504 timeout
- Anthropic API timeout reduced from 60s to 30s
- Added automatic retry with 5 findings on first 504 error
- Added final retry with 2 findings if still timing out
- Backend includes timeout detection with minimal fallback response
- Made `processQueue()` public for immediate triggering

### 5. Comprehensive Error Handling
- Enhanced topic deletion confirmation with detailed warnings
- Added try-catch blocks with proper error logging
- User-friendly error messages throughout
- Event-driven updates for UI synchronization

### 6. Browser Cache Configuration (CRITICAL FIX)
- **Changed**: JS/CSS from 30d immutable to 1h must-revalidate
- **Impact**: Fixes prevented updates from reaching users
- **Service Worker**: Version bump forces cache refresh
- **Lesson**: Never use `immutable` for frequently changing files

## Files Modified
- `src/utils/db/topics.ts` - Server storage delegation
- `src/components/ChatPanelMinimal.tsx` - Topic change detection
- `src/components/Dashboard.tsx` - Digest queue initialization
- `src/components/FindingsViewerProgressive.tsx` - Auto-queue digest
- `src/services/digestQueue.service.ts` - Timeout handling
- `src/components/TopicManager.tsx` - Error handling
- `src/services/topics.service.ts` - Logging improvements
- `nginx.conf` - Cache headers fixed (Jan 26)
- `public/sw.js` - Version bump and JS exclusion (Jan 26)

## Container Status
```
Container ID: 738cd506837c
Status: Running (healthy)
Backend: Connected to PostgreSQL ✅
Port: 6767 (nginx) / 3001 (backend API)
Image: medical-companion-pwa:cache-fix
Network: medical-pwa_medcompanion-network
Database: postgresql://meduser@medcompanion-postgres:5432/medcompanion
```

## Testing Instructions

1. **Test Topic Deletion**:
   - Create a topic and run agents
   - Delete the topic
   - Create a new topic
   - Verify chat doesn't show old messages

2. **Test Digest Auto-Generation**:
   - Create topic and run agents
   - Navigate to Findings page
   - Should see digest generating automatically (no manual button click needed)
   - Progress should update in real-time

3. **Test Error Handling**:
   - Try operations with network disconnected
   - Verify proper error messages appear
   - Check that operations can be retried

4. **Test Login (CRITICAL)**:
   - Clear browser cache or use incognito mode
   - Login should work without localhost:3001 errors
   - Authentication should persist across sessions

## Known Considerations

- **IMPORTANT**: Digest generation limited to **10 findings** (5 on first retry, 2 on final retry) to prevent Cloudflare 504 timeouts
- Anthropic API timeout set to 30 seconds (reduced from 60s)
- Queue processes every 5 seconds but can be triggered immediately
- All cascade deletions handled by PostgreSQL foreign key constraints
- Cloudflare has a 100-second timeout limit that cannot be changed
- Browser cache now set to 1 hour for JS/CSS files with revalidation

## Lessons Learned

### Browser Caching Best Practices
1. **Never use `immutable`** for JavaScript/CSS files
2. **Short TTLs with revalidation** for frequently changing assets
3. **Version bump service workers** to force cache refresh
4. **Symptom**: "Works in incognito but not regular browser" = cache issue
5. **Debug approach**: Check nginx cache headers, service worker version, browser DevTools Network tab

### Deployment Verification
1. Always check browser Network tab for actual loaded resources
2. Verify response headers match nginx configuration
3. Clear browser cache after major deployments
4. Consider cache-busting strategies for critical updates

## Next Steps

1. Monitor digest generation performance
2. Check logs for any 504 errors
3. Verify all topic deletions cascade properly
4. Consider increasing finding limits if AI API performance improves
5. Implement cache-busting strategy for future deployments
6. Add monitoring for failed authentication attempts