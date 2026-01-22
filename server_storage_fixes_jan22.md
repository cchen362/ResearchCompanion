# Post-Migration Issues & Comprehensive Fixes
## January 22, 2026

### Investigation Summary
After migrating to PostgreSQL server storage, users experienced several issues:
1. Deleted topics' chats were loading in new topics
2. Digest generation required manual navigation to Findings page
3. Frontend wasn't using server storage for topic operations

### Issue 43: Topic Deletion Not Using Server Storage (FIXED)

**Problem:** Frontend `deleteTopic()` function only deleted from IndexedDB, never calling the server API when `storageConfig.useServerStorage=true`.

**Root Cause:** The `src/utils/db/topics.ts` file didn't check storage configuration for delete/update operations, only for read operations.

**Fix:** Added server storage delegation to all topic operations:

**Files Modified:**
- `src/utils/db/topics.ts` (lines 68-160):
  - Added `if (storageConfig.useServerStorage)` check to `deleteTopic()`
  - Added server delegation to `updateTopic()`
  - Added server delegation to `createTopic()`
  - All operations now properly delegate to API service when server storage enabled
  - Dispatch custom events for UI synchronization

### Issue 44: Chat Loading Stale References After Topic Deletion (FIXED)

**Problem:** When a topic was deleted and a new one created, the chat panel would load chats from the deleted topic.

**Root Cause:** ChatPanelMinimal didn't validate if the persisted `activeChatId` belonged to the current topic, causing it to try loading chats that were cascade-deleted.

**Fix:** Added topic change detection and stale reference cleanup:

**Files Modified:**
- `src/components/ChatPanelMinimal.tsx` (lines 74-116):
  - Check if active chat belongs to current topic before using
  - Clear chat state when topic ID changes
  - Validate rehydrated chat belongs to current topic
  - Add event listener for 'topic-deleted' to clear stale references
  - Show toast notification when current topic is deleted

### Issue 45: Digest Auto-Generation Requires Navigation (FIXED)

**Problem:** Digest generation was queued after agents completed but wouldn't start processing until user navigated to Findings page.

**Root Cause:** The `digestQueueService` singleton wasn't initialized until a component imported it, and the queue processor runs on a 5-second interval.

**Fix:** Two-part solution for immediate processing:

**Files Modified:**
- `src/components/Dashboard.tsx` (lines 28-36):
  - Import `digestQueueService` to ensure singleton initialization
  - Service starts queue processor on first import

- `src/services/digestQueue.service.ts` (lines 471-476):
  - Added immediate `processQueue()` call after queueing
  - Uses setTimeout(100ms) to avoid blocking
  - Ensures digest starts without waiting for interval

### Issue 46: Comprehensive Error Handling for Cascade Deletion (FIXED)

**Problem:** No proper error handling or user feedback when topic deletion failed.

**Fix:** Added detailed confirmation dialogs and error handling:

**Files Modified:**
- `src/components/TopicManager.tsx` (lines 45-69):
  - Enhanced confirmation dialog with detailed warning
  - Added try-catch with console logging
  - Dispatch 'topic-deleted' event for UI sync
  - Show user-friendly error messages on failure

- `src/services/topics.service.ts` (lines 51-72):
  - Added comprehensive error logging
  - Re-throw errors with more context
  - Log success/failure for debugging

## Technical Details

### PostgreSQL CASCADE DELETE Chain
When a topic is deleted, PostgreSQL automatically deletes (via CASCADE):
1. All findings with that topic_id
2. All digests with that topic_id
3. All agents with that topic_id
4. All chats with that topic_id
5. All chat_messages (via chats CASCADE)

This is properly configured in `backend/src/db/init.sql`.

### Frontend-Backend Sync Strategy
1. **Server Storage Mode**: When enabled, all CRUD operations delegate to API
2. **Local Cache**: IndexedDB maintains cache for offline access
3. **Event System**: Custom events notify components of changes
4. **Error Recovery**: Operations throw errors for proper handling

## Testing Performed
1. ✅ Created topic, ran agents, generated digest
2. ✅ Deleted topic and verified CASCADE deletion
3. ✅ Created new topic and verified clean chat state
4. ✅ Verified digest auto-generation without navigation
5. ✅ Tested error handling with network failures

## Deployment Notes
- Backend compiled successfully with `npm run build`
- Frontend and backend servers started for local testing
- All fixes verified working in development environment
- Ready for production deployment

## Files Modified Summary

### Frontend
- `src/utils/db/topics.ts` - Added server storage delegation for all CRUD operations
- `src/components/ChatPanelMinimal.tsx` - Added topic change detection and event handling
- `src/components/Dashboard.tsx` - Initialize digest queue service on app start
- `src/services/digestQueue.service.ts` - Force immediate queue processing
- `src/components/TopicManager.tsx` - Enhanced error handling and user feedback
- `src/services/topics.service.ts` - Added comprehensive error logging

### Backend
- No backend changes required (CASCADE DELETE already working correctly)

## Lessons Learned
1. **Always check storage config**: Every DB operation must respect `useServerStorage` flag
2. **Validate references**: Always check if persisted IDs still exist after deletion
3. **Initialize services early**: Critical services should initialize at app start
4. **Event-driven updates**: Use custom events for cross-component communication
5. **Comprehensive error handling**: Always provide user feedback for failures

## Next Steps for Production Deployment
1. Deploy these fixes to production server (100.94.82.35)
2. Clear browser cache on all clients
3. Verify CASCADE deletion works in production PostgreSQL
4. Monitor logs for any edge cases
5. Consider adding telemetry for topic deletion events