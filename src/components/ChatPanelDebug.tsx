import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

console.log('[ChatPanelDebug] File loading started');

// Log each import as it happens
console.log('[ChatPanelDebug] Starting imports...');

let useChatStore: any;
let useFindingsStore: any;
let useUIStore: any;
let ChatMessage: any;
let ChatInput: any;

// Wrap all imports in try-catch to identify which one fails
try {
  console.log('[ChatPanelDebug] Importing useChatStore...');
  const chatStoreModule = require('../stores/chatStore');
  useChatStore = chatStoreModule.useChatStore;
  console.log('[ChatPanelDebug] useChatStore imported successfully');
} catch (e) {
  console.error('[ChatPanelDebug] Failed to import useChatStore:', e);
}

try {
  console.log('[ChatPanelDebug] Importing useFindingsStore...');
  const findingsStoreModule = require('../stores/findingsStore');
  useFindingsStore = findingsStoreModule.useFindingsStore;
  console.log('[ChatPanelDebug] useFindingsStore imported successfully');
} catch (e) {
  console.error('[ChatPanelDebug] Failed to import useFindingsStore:', e);
}

try {
  console.log('[ChatPanelDebug] Importing useUIStore...');
  const uiStoreModule = require('../stores/uiStore');
  useUIStore = uiStoreModule.useUIStore;
  console.log('[ChatPanelDebug] useUIStore imported successfully');
} catch (e) {
  console.error('[ChatPanelDebug] Failed to import useUIStore:', e);
}

try {
  console.log('[ChatPanelDebug] Importing ChatMessage...');
  const chatMessageModule = require('./ChatMessage');
  ChatMessage = chatMessageModule.ChatMessage;
  console.log('[ChatPanelDebug] ChatMessage imported successfully');
} catch (e) {
  console.error('[ChatPanelDebug] Failed to import ChatMessage:', e);
}

try {
  console.log('[ChatPanelDebug] Importing ChatInput...');
  const chatInputModule = require('./ChatInput');
  ChatInput = chatInputModule.ChatInput;
  console.log('[ChatPanelDebug] ChatInput imported successfully');
} catch (e) {
  console.error('[ChatPanelDebug] Failed to import ChatInput:', e);
}

console.log('[ChatPanelDebug] All imports completed');

interface ChatPanelProps {
  topicId: string;
  topicName: string;
  className?: string;
  onClose?: () => void;
}

export function ChatPanel({ topicId, topicName, className = '', onClose }: ChatPanelProps) {
  console.log('[ChatPanelDebug] Component function called');

  // Simple debug UI for now
  return (
    <div className={`bg-white p-4 ${className}`}>
      <h2 className="text-xl font-bold mb-4">Chat Debug Mode</h2>
      <div className="space-y-2">
        <p>Topic: {topicName}</p>
        <p>Topic ID: {topicId}</p>
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold">Import Status:</h3>
          <ul className="text-sm mt-2 space-y-1">
            <li>✓ useChatStore: {useChatStore ? 'Loaded' : 'Failed'}</li>
            <li>✓ useFindingsStore: {useFindingsStore ? 'Loaded' : 'Failed'}</li>
            <li>✓ useUIStore: {useUIStore ? 'Loaded' : 'Failed'}</li>
            <li>✓ ChatMessage: {ChatMessage ? 'Loaded' : 'Failed'}</li>
            <li>✓ ChatInput: {ChatInput ? 'Loaded' : 'Failed'}</li>
          </ul>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close Chat
          </button>
        )}
      </div>
      <div className="mt-4 text-xs text-gray-500">
        Check browser console for detailed initialization logs
      </div>
    </div>
  );
}

console.log('[ChatPanelDebug] Component exported');