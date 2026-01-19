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

  // Parse message content - clean display with proper HTML formatting
  const formattedContent = useMemo(() => {
    if (!message.content) return '';

    // Debug logging to trace citation issue
    console.log('📝 [ChatMessage] Rendering message with citations:', {
      citationsArray: message.citations,
      citationCount: message.citations?.length || 0,
      firstCitation: message.citations?.[0]
    });

    let content = message.content;

    // Remove emojis
    content = content.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

    // Process citations first - make them clickable
    // Match patterns like [1], [2, 3], [1, 6, 7, 10, 11], etc.
    content = content.replace(/\[([0-9,\s]+)\]/g, (match, citationNumbers) => {
      const numbers = citationNumbers.split(',').map((n: string) => n.trim());
      const citationLinks = numbers.map((num: string) => {
        // CRITICAL FIX: Find citation by citationNumber property, NOT array index
        const citationNum = parseInt(num);
        const citation = message.citations?.find(c => c.citationNumber === citationNum);

        console.log(`🔍 [ChatMessage] Looking for citation [${num}]:`, {
          searchingFor: citationNum,
          found: !!citation,
          citationObject: citation
        });

        if (citation) {
          return `<button data-citation-id="${citation.findingId}" data-citation-num="${num}" class="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded transition-all cursor-pointer hover:shadow-sm" title="Click to view finding">[${num}]</button>`;
        }
        return `<span class="text-muted-foreground">[${num}]</span>`;
      }).join('');
      return citationLinks;
    });

    // Process in order to maintain structure

    // 1. Convert headings to styled divs (removes ## but keeps structure)
    content = content.replace(/^#{1,6}\s+(.+)$/gm, (match, heading) => {
      return `<h3 class="font-semibold text-base mt-4 mb-2 text-foreground uppercase tracking-wide">${heading}</h3>`;
    });

    // 2. Convert bold text (removes ** but keeps emphasis)
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');

    // 3. Convert italic text (removes * but keeps emphasis)
    content = content.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

    // 4. Process lists properly
    const lines = content.split('\n');
    let processedContent = [];
    let currentList = [];
    let inList = false;

    for (const line of lines) {
      if (line.match(/^[\*\-]\s+/)) {
        // List item
        if (!inList) {
          inList = true;
          currentList = [];
        }
        currentList.push(line.replace(/^[\*\-]\s+/, '').trim());
      } else {
        // Not a list item
        if (inList && currentList.length > 0) {
          // Close the current list
          const listHtml = `<ul class="my-3 space-y-2">${currentList.map(item =>
            `<li class="flex items-start gap-2">
              <span class="text-primary mt-1">•</span>
              <span class="flex-1">${item}</span>
            </li>`
          ).join('')}</ul>`;
          processedContent.push(listHtml);
          currentList = [];
          inList = false;
        }
        if (line.trim()) {
          processedContent.push(line);
        }
      }
    }

    // Close any remaining list
    if (inList && currentList.length > 0) {
      const listHtml = `<ul class="my-3 space-y-2">${currentList.map(item =>
        `<li class="flex items-start gap-2">
          <span class="text-primary mt-1">•</span>
          <span class="flex-1">${item}</span>
        </li>`
      ).join('')}</ul>`;
      processedContent.push(listHtml);
    }

    content = processedContent.join('\n');

    // 5. Handle code blocks
    content = content.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre class="bg-muted/30 p-3 rounded-md my-3 overflow-x-auto"><code class="text-sm font-mono">${code.trim()}</code></pre>`;
    });

    // 6. Handle inline code
    content = content.replace(/`([^`]+)`/g, '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

    // 7. Create paragraphs from double line breaks
    const paragraphs = content.split(/\n\n+/);
    content = paragraphs
      .filter(p => p.trim())
      .map(p => {
        // Don't wrap if already contains block elements
        if (p.includes('<ul') || p.includes('<h3') || p.includes('<pre') || p.includes('<div')) {
          return p;
        }
        // Wrap in paragraph
        return `<p class="text-base leading-relaxed mb-3">${p}</p>`;
      })
      .join('');

    return content || '<p class="text-muted-foreground">No content</p>';
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

  // Get message alignment and styling based on role with enhanced visuals
  const messageStyles = {
    user: 'ml-auto bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md border-primary/20',
    assistant: 'mr-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm',
    system: 'mx-auto bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 shadow-sm'
  };

  const isLongMessage = message.content.length > 500;

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${className} animate-fadeIn`}>
      <div className={`flex gap-3 max-w-full md:max-w-[85%] lg:max-w-3xl ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${message.role === 'system' ? 'hidden' : ''}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === 'user'
              ? 'bg-primary/10 text-primary'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            <MessageIcon />
          </div>
        </div>

        {/* Message Card */}
        <Card className={`flex-1 p-4 transition-all hover:shadow-md ${messageStyles[message.role]}`}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium capitalize text-sm">{message.role}</span>
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
                onClick={(e) => {
                  // Handle clicks on citation buttons
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'BUTTON' && target.dataset.citationId) {
                    e.preventDefault();
                    e.stopPropagation();
                    onCitationClick?.(target.dataset.citationId);
                  }
                }}
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
    </div>
  );
}