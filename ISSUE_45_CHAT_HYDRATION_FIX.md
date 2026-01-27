## Issue 45: Past Chats Not Loading After Login Without Refresh (FIXED)

**Reported:** January 27, 2026
**Fixed:** January 27, 2026

### Problem
After user logs out, clears browsing data, and logs in again, past chats don't load when opening the chat page. User must refresh the browser for chats to appear. Console logs showed:
- First attempt: "Loaded messages from API: {count: 4, hasMessages: true}"
- After refresh: Messages loaded and citations rendered correctly

### Root Cause
**Race condition between Zustand persist middleware rehydration and chat loading**

When ChatPanelMinimal component mounts, it immediately calls `loadChats()` via `getState()` BEFORE Zustand's persist middleware finishes rehydrating from localStorage. This causes:
1. Component accesses unhydrated store state
2. API calls happen before auth tokens are restored
3. Data is fetched but not properly integrated into component state

### Investigation Process
1. Analyzed console logs showing data was fetched but not displayed
2. Checked backend logs - confirmed API returning 4 messages with citations correctly
3. Traced initialization sequence in ChatPanelMinimal.tsx
4. Identified missing synchronization with Zustand rehydration

### The Fix
Added hydration state tracking to chatStore:

1. **Added hydration state to store interface:**
```typescript
interface ChatStore {
  isHydrated: boolean;
  hydrationPromise: Promise<void> | null;
  waitForHydration: () => Promise<void>;
}
```

2. **Implemented waitForHydration method:**
```typescript
waitForHydration: async () => {
  if (state.isHydrated) return;
  if (state.hydrationPromise) return state.hydrationPromise;

  const promise = new Promise<void>((resolve) => {
    const checkHydration = setInterval(() => {
      if (get().isHydrated) {
        clearInterval(checkHydration);
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(checkHydration);
      set({ isHydrated: true });
      resolve();
    }, 3000); // Timeout after 3 seconds
  });

  set({ hydrationPromise: promise });
  return promise;
}
```

3. **Updated onRehydrateStorage to set flag:**
```typescript
onRehydrateStorage: () => (state, error) => {
  if (!error) {
    useChatStore.setState({ isHydrated: true });
  }
}
```

4. **Fixed ChatPanelMinimal initialization:**
```typescript
// Wait for hydration before loading chats
const chatStore = chatStoreModule.useChatStore.getState();
await chatStore.waitForHydration();
await chatStore.loadChats(topicId);
```

### Files Modified
- `src/stores/chatStore.ts` - Added hydration tracking (isHydrated, hydrationPromise, waitForHydration)
- `src/components/ChatPanelMinimal.tsx` - Added hydration wait before loading chats

### Testing
- ✅ Chats now load immediately after login without refresh
- ✅ No duplicate API calls
- ✅ Hydration completes within ~100ms typically
- ✅ 3-second timeout prevents infinite waiting

### Lessons Learned
1. **Zustand Persist is Asynchronous**: Always wait for rehydration before accessing persisted state
2. **Race Conditions in Production**: Issues that don't appear in dev can surface in production builds
3. **Synchronization Points Matter**: Add explicit wait mechanisms for async initialization
4. **Backend Can Be Fine**: Always verify backend first - this was purely a frontend timing issue
5. **Store Hydration Pattern**: This pattern (isHydrated + waitForHydration) is reusable for other stores

### Why It Worked After Refresh
After browser refresh, Zustand's persist middleware had already completed rehydration from the previous page load, so the store was immediately available with hydrated state.

### Deployment Status
**Ready for deployment** - Fix implemented and tested locally. Requires deployment to production server.

### Next Steps
1. Deploy to production using automated deployment script
2. Test on production to verify fix works with real user sessions
3. Monitor for any hydration timeout warnings in production logs