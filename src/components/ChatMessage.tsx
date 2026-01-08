import React, { useState, useMemo } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  User,
  Bot,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { ChatMessage as ChatMessageType, SourceCitation } from '../types';
import { format } from 'date-fns';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onCitationClick?: (findingId: string) => void;
  className?: string;
}

export function ChatMessage({
  message,
  isStreaming = false,
  onCitationClick,
  className = ''
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  // Parse message content for better display
  const formattedContent = useMemo(() => {
    if (!message.content) return '';

    let content = message.content;

    // Convert markdown-style formatting
    // Bold text
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic text
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Code blocks
    content = content.replace(/```([\s\S]*?)```/g, '<pre class="bg-muted p-2 rounded my-2"><code>$1</code></pre>');

    // Inline code
    content = content.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded">$1</code>');

    // Lists
    content = content.replace(/^- (.+)$/gm, '<li>$1</li>');
    content = content.replace(/(<li>.*<\/li>)/s, '<ul class="list-disc pl-5 my-2">$1</ul>');

    // Line breaks
    content = content.replace(/\n\n/g, '</p><p class="mb-2">');
    content = `<p class="mb-2">${content}</p>`;

    return content;
  }, [message.content]);

  // Convert markdown to plain text for copying
  const convertToPlainText = (content: string): string => {
    let plainText = content;

    // Remove markdown syntax
    plainText = plainText.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    plainText = plainText.replace(/\*(.*?)\*/g, '$1'); // Italic
    plainText = plainText.replace(/`([^`]+)`/g, '$1'); // Inline code
    plainText = plainText.replace(/```[\s\S]*?```/g, ''); // Code blocks
    plainText = plainText.replace(/^- /gm, '• '); // Convert list markers to bullets
    plainText = plainText.replace(/^#{1,6}\s+/gm, ''); // Remove heading markers
    plainText = plainText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links to text only
    plainText = plainText.replace(/\n\n\n+/g, '\n\n'); // Clean extra newlines

    // Add citation references if present
    if (message.citations && message.citations.length > 0) {
      plainText += '\n\nReferences:\n';
      message.citations.forEach((citation, index) => {
        plainText += `[${index + 1}] ${citation.source || 'Source'}: ${citation.citationText || ''}\n`;
      });
    }

    return plainText.trim();
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      const plainText = convertToPlainText(message.content);
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Get message icon based on role
  const MessageIcon = () => {
    switch (message.role) {
      case 'user':
        return <User className="h-5 w-5" />;
      case 'assistant':
        return isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bot className="h-5 w-5" />;
      case 'system':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  // Get message alignment and styling based on role
  const messageStyles = {
    user: 'ml-auto bg-primary text-primary-foreground',
    assistant: 'mr-auto bg-muted',
    system: 'mx-auto bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
  };

  const isLongMessage = message.content.length > 500;

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${className}`}>
      <Card className={`max-w-full md:max-w-[85%] lg:max-w-3xl p-4 ${messageStyles[message.role]}`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <MessageIcon />
          <span className="font-medium capitalize">{message.role}</span>
          {message.timestamp && (
            <span className="text-xs text-muted-foreground ml-auto">
              {format(new Date(message.timestamp), 'HH:mm')}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words">
          {isStreaming ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Generating response...</span>
            </div>
          ) : (
            <>
              <div
                className={`message-content ${!expanded && isLongMessage ? 'line-clamp-6' : ''}`}
                dangerouslySetInnerHTML={{ __html: formattedContent }}
              />

              {/* Show more/less button for long messages */}
              {isLongMessage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 p-0 h-auto"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show more
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCitations(!showCitations)}
              className="mb-2"
            >
              <FileText className="h-4 w-4 mr-1" />
              {message.citations.length} Citation{message.citations.length > 1 ? 's' : ''}
              {showCitations ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>

            {showCitations && (
              <div className="space-y-2">
                {message.citations.map((citation, index) => (
                  <div
                    key={`${citation.findingId}_${index}`}
                    className="flex items-start gap-2 p-2 bg-background/50 rounded cursor-pointer hover:bg-background/70 transition-colors"
                    onClick={() => onCitationClick?.(citation.findingId)}
                  >
                    <Badge variant="outline" className="mt-0.5">
                      [{citation.citationNumber || index + 1}]
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm line-clamp-2">{citation.citationText}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          View finding
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metadata - removed model name display, keeping only tokens/time for debugging if needed */}

        {/* Actions */}
        {message.role === 'assistant' && !isStreaming && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )}

        {/* Error state */}
        {message.metadata?.error && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{message.metadata.error}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}