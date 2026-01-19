# Chat Feature Restoration Guide

## Purpose
This guide provides step-by-step instructions for restoring the chat interface to its full functionality while maintaining the stability achieved through the circular dependency fixes.

## Current State (January 19, 2026)

### ✅ What's Working
- Chat panel opens without crashes
- Messages are sent and received successfully
- Authentication works (using api.post())
- Messages persist to chatStore
- Chat creation and management functions
- Using ChatPanelMinimal.tsx with dynamic imports
- POST /chat/complete endpoint (non-streaming)

### ❌ What's Broken
1. **Markdown Rendering**: Raw symbols showing (**, ##)
2. **Citations**: Appear as plain text [1, 2, 3] instead of clickable buttons
3. **Component Usage**: Using plain `<p>` tags instead of ChatMessage component
4. **Input Experience**: Basic HTML input instead of ChatInput component
5. **Missing Features**: No suggested questions, export, clear, maximize

### ⚠️ Technical Constraints
**CRITICAL**: Must maintain the dynamic import pattern to avoid circular dependencies:
```typescript
// ✅ SAFE: Dynamic imports for stores/services
useEffect(() => {
  const loadDependencies = async () => {
    const [chatStoreModule] = await Promise.all([
      import('../stores/chatStore')
    ]);
  };
}, []);

// ✅ SAFE: Direct imports for UI components
import { ChatMessage } from './ChatMessage'; // No circular dependency
import { ChatInput } from './ChatInput';     // No circular dependency
```

## Phase 1: Fix Visual Issues (HIGH PRIORITY)

### Step 1.1: Import ChatMessage Component

**File**: `src/components/ChatPanelMinimal.tsx`

**Add import at top (after React imports):**
```typescript
import { ChatMessage } from './ChatMessage';
```

**Why this is safe**: ChatMessage doesn't import stores directly, only receives props.

### Step 1.2: Replace Message Rendering

**Find this code (around line 180-192):**
```typescript
{messages.map((msg, idx) => (
  <div
    key={idx}
    className={`p-3 rounded-lg ${
      msg.role === 'user'
        ? 'bg-blue-50 ml-auto max-w-[80%]'
        : 'bg-gray-50 mr-auto max-w-[80%]'
    }`}
  >
    <p className="text-sm">{msg.content}</p>
  </div>
))}
```

**Replace with:**
```typescript
{messages.map((msg, idx) => (
  <ChatMessage
    key={idx}
    message={msg}
    onCitationClick={handleCitationClick}
    isStreaming={false}
  />
))}
```

### Step 1.3: Add Citation Click Handler

**Add this function before the return statement:**
```typescript
const handleCitationClick = (citationNumber: number) => {
  // Find the citation in the current message
  const citation = messages
    .flatMap(m => m.citations || [])
    .find(c => c.citationNumber === citationNumber);

  if (citation && citation.findingId) {
    // Navigate to the finding
    console.log('Navigate to finding:', citation.findingId);
    // TODO: Implement navigation to finding viewer
  }
};
```

### Step 1.4: Test Phase 1
1. **Build**: `npm run build`
2. **Run**: `npm run dev`
3. **Test**:
   - Open chat panel
   - Send a message
   - Verify markdown renders properly (bold text, headings)
   - Verify citations show as blue buttons
   - Click a citation button (should log to console)

### Rollback if Broken
If ChatMessage import causes issues:
1. Comment out the import
2. Revert to original message rendering
3. Check ChatMessage.tsx for any store imports

## Phase 2: Enhance Input Experience

### Step 2.1: Import ChatInput Component

**File**: `src/components/ChatPanelMinimal.tsx`

**Add import:**
```typescript
import { ChatInput } from './ChatInput';
```

### Step 2.2: Replace Input Section

**Find this code (around line 198-217):**
```typescript
<div className="border-t p-4">
  <div className="flex gap-2">
    <input
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
      placeholder="Type your message..."
      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      disabled={isLoading}
    />
    <button
      onClick={handleSendMessage}
      disabled={isLoading || !inputValue.trim()}
      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
    </button>
  </div>
</div>
```

**Replace with:**
```typescript
<ChatInput
  value={inputValue}
  onChange={setInputValue}
  onSend={handleSendMessage}
  isLoading={isLoading}
  placeholder="Type your message..."
  maxLength={4000}
/>
```

### Step 2.3: Add Suggested Questions

**Add state for suggestions:**
```typescript
const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
```

**After receiving AI response (in handleSendMessage):**
```typescript
// Add AI response to messages
const aiMessage = {
  id: Date.now().toString(),
  role: 'assistant',
  content: response.data.content,
  citations: response.data.citations,
  timestamp: new Date()
};
setMessages(prev => [...prev, aiMessage]);

// Set suggested questions if available
if (response.data.suggestedQuestions) {
  setSuggestedQuestions(response.data.suggestedQuestions);
}
```

**Add suggested questions display (after messages, before input):**
```typescript
{suggestedQuestions.length > 0 && (
  <div className="p-4 border-t">
    <p className="text-sm text-gray-600 mb-2">Suggested questions:</p>
    <div className="flex flex-wrap gap-2">
      {suggestedQuestions.map((question, idx) => (
        <button
          key={idx}
          onClick={() => {
            setInputValue(question);
            setSuggestedQuestions([]);
          }}
          className="text-sm px-3 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100"
        >
          {question}
        </button>
      ))}
    </div>
  </div>
)}
```

### Step 2.4: Test Phase 2
1. Send a message
2. Verify ChatInput provides better UX
3. Check if suggested questions appear
4. Click a suggested question (should populate input)

## Phase 3: Advanced Features

### Step 3.1: Add Header Actions

**Add imports:**
```typescript
import { Button } from './ui/button';
import { Download, Trash2, Maximize2 } from 'lucide-react';
```

**Modify header section:**
```typescript
<div className="flex items-center justify-between p-4 border-b">
  <div className="flex items-center gap-2">
    <MessageSquare className="w-5 h-5" />
    <h2 className="font-semibold">{topicName}</h2>
  </div>
  <div className="flex items-center gap-2">
    <Button
      size="icon"
      variant="ghost"
      onClick={handleExport}
      title="Export chat"
    >
      <Download className="w-4 h-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      onClick={handleClear}
      title="Clear chat"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      onClick={handleMaximize}
      title="Maximize"
    >
      <Maximize2 className="w-4 h-4" />
    </Button>
    {onClose && (
      <Button
        size="icon"
        variant="ghost"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </Button>
    )}
  </div>
</div>
```

### Step 3.2: Implement Actions

**Add handler functions:**
```typescript
const handleExport = async () => {
  try {
    const { chatService } = await import('../services/chat.service');
    const markdown = await chatService.exportChat(
      topicId,
      stores.useChatStore.getState().activeChatId!,
      'markdown'
    );

    // Download as file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${topicName}-${new Date().toISOString()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export chat:', error);
  }
};

const handleClear = async () => {
  if (!confirm('Are you sure you want to clear this chat?')) return;

  try {
    const { chatService } = await import('../services/chat.service');
    await chatService.clearMessages(
      topicId,
      stores.useChatStore.getState().activeChatId!
    );
    setMessages([]);
  } catch (error) {
    console.error('Failed to clear chat:', error);
  }
};

const handleMaximize = () => {
  // TODO: Implement fullscreen mode
  console.log('Maximize not yet implemented');
};
```

## Testing Checklist

After each phase:
- [ ] No console errors
- [ ] Chat panel opens without crash
- [ ] Can send and receive messages
- [ ] Can navigate away and back
- [ ] State persists on refresh
- [ ] No circular dependency warnings in build

## Rollback Strategy

If any change breaks the app:

1. **Identify the breaking change**:
   - Check console for errors
   - Look for "Cannot access X before initialization"
   - Check network tab for failed requests

2. **Rollback**:
   - Comment out the new code
   - Restore previous working version
   - Rebuild and test

3. **Debug**:
   - Add console.logs to trace execution
   - Check if component has hidden store imports
   - Verify dynamic imports are truly dynamic

## Common Pitfalls to Avoid

### ❌ DON'T Do This:
```typescript
// Static import of stores at top level
import { useChatStore } from '../stores/chatStore';

// Static import of services at top level
import { chatService } from '../services/chat.service';
```

### ✅ DO This Instead:
```typescript
// Dynamic import in useEffect
useEffect(() => {
  const loadStores = async () => {
    const { useChatStore } = await import('../stores/chatStore');
  };
}, []);

// Dynamic import in event handlers
const handleAction = async () => {
  const { chatService } = await import('../services/chat.service');
};
```

## Success Metrics

### Phase 1 Complete When:
- Markdown renders properly (no raw symbols)
- Citations show as clickable buttons
- Messages have proper styling

### Phase 2 Complete When:
- ChatInput provides rich input experience
- Suggested questions appear and work
- Better UX for message composition

### Phase 3 Complete When:
- Export downloads chat transcript
- Clear removes messages with confirmation
- All action buttons functional

## Next Agent Instructions

1. **Start with Phase 1.1** - Import ChatMessage component
2. **Test after EACH step** - Don't make multiple changes at once
3. **Watch for circular dependencies** - Any "Cannot access X" errors mean rollback
4. **Keep dynamic imports** - This is the key to stability
5. **Document any issues** - Update this guide if you find problems

## Files Reference

- **Current Implementation**: `src/components/ChatPanelMinimal.tsx`
- **Lazy Wrapper**: `src/components/ChatPanelLazy.tsx`
- **Message Component**: `src/components/ChatMessage.tsx`
- **Input Component**: `src/components/ChatInput.tsx`
- **Original (Broken)**: `src/components/ChatPanel.tsx` (DO NOT USE)

---

*Last Updated: January 19, 2026*
*Status: Chat working, formatting needs fix*
*Next Step: Implement Phase 1.1*