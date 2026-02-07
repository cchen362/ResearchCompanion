import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Button } from './ui/button';
import {
  Send,
  Loader2,
  FileText
} from 'lucide-react';
import { useResearchStore } from '../stores/researchStore';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showTypingIndicator?: boolean;
  maxLength?: number;
  className?: string;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...',
  showTypingIndicator = false,
  maxLength = 4000,
  className = ''
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const { selectedFindings } = useResearchStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`;
    }
  }, [message]);

  // Handle send message
  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      textareaRef.current?.focus();
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) {
        handleSend();
      }
    }
  };

  const selectedCount = selectedFindings.size;

  return (
    <div className={`bg-background ${className}`}>
      {/* Typing indicator */}
      {showTypingIndicator && (
        <div className="px-4 py-2 border-b bg-gradient-to-r from-transparent via-gray-50/50 to-transparent dark:via-gray-800/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="animate-float-in">AI is thinking...</span>
          </div>
        </div>
      )}

      {/* Selected findings indicator */}
      {selectedCount > 0 && (
        <div className="px-4 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {selectedCount} finding{selectedCount > 1 ? 's' : ''} will be included as context
            </span>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-2 md:p-4">
        <div className="flex gap-2 items-end max-w-5xl mx-auto">
          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full px-4 py-3 text-base bg-background border-2 border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-600"
              rows={1}
              style={{ minHeight: '48px' }}
            />
            {message.length > maxLength * 0.8 && (
              <span className={`absolute bottom-2 right-2 text-xs transition-opacity duration-200 ${
                message.length > maxLength * 0.9 ? 'text-destructive' : 'text-muted-foreground'
              } animate-float-in`}>
                {message.length}/{maxLength}
              </span>
            )}
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            size="icon"
            title="Send message (Enter)"
            className="transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {disabled && showTypingIndicator ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 transition-transform duration-150" />
            )}
          </Button>
        </div>

        {/* Help text */}
        <div className="mt-2 text-xs text-muted-foreground text-center max-w-5xl mx-auto">
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
