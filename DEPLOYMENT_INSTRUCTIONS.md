# Deployment Instructions - Chat Citation Fixes

## Changes Made (Commit 384b07a)

Fixed critical chat citation issues:
1. Topic ID being passed as object causing 500 errors
2. Citations showing as plain text instead of blue links
3. Missing citations in the citation array

## Deployment Steps

1. **SSH into the server:**
   ```bash
   ssh chee@100.94.82.35
   ```

2. **Navigate to project directory:**
   ```bash
   cd /home/chee/medical-pwa
   ```

3. **Pull the latest changes:**
   ```bash
   git pull origin fix/digest-findings-race-condition
   ```

   You should see:
   ```
   Updating cd47224..384b07a
   ```

4. **Rebuild and restart containers:**
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

5. **Verify deployment:**
   ```bash
   # Check if containers are running
   docker ps

   # Check backend logs for errors
   docker-compose logs backend --tail 50

   # Check frontend is accessible
   curl -I http://localhost:6767
   ```

## Testing After Deployment

1. **Test Citation Display:**
   - Open a topic with 20+ findings
   - Send a message asking about the research
   - Verify ALL citations appear as blue clickable buttons
   - Check that citations [1] through [20] all render properly

2. **Test Citation Clicks:**
   - Click on any blue citation button
   - Verify the finding modal opens without errors
   - Check browser console - should NOT see `topic_id=[object Object]` errors

3. **Check Debug Logs (backend):**
   ```bash
   docker-compose logs backend -f
   ```

   Look for these success messages:
   - `📚 [enrichFindingsContext] Using X findings from frontend`
   - `✅ [extractCitations] Citation [X] mapped to finding...`
   - `📚 [extractCitations] Final result: Extracted X valid citations`

## Rollback Instructions (if needed)

If issues occur, rollback to previous version:

```bash
cd /home/chee/medical-pwa
git reset --hard cd47224
docker-compose down
docker-compose up --build -d
```

## Debug Information

The changes add comprehensive logging. If issues persist, check:

1. **Frontend Console:**
   - `[ChatPanel] Loading findings for topic...`
   - `[ChatPanel] Sending findings context: {count: X}`

2. **Backend Logs:**
   - Citation extraction details
   - Finding context enrichment
   - Citation number mapping

## Contact

If deployment issues occur, the changes are in:
- Frontend: `src/components/ChatPanelMinimal.tsx`
- Backend: `backend/src/routes/chat.routes.ts`

Both files have detailed logging to help trace any remaining issues.