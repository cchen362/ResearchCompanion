import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  X,
  Loader2,
  FileText,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { useFindingsStore } from '../stores/findingsStore';
import { useUIStore } from '../stores/uiStore';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showTypingIndicator?: boolean;
  maxLength?: number;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  className?: string;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...',
  showTypingIndicator = false,
  maxLength = 4000,
  allowAttachments = false,
  allowVoice = false,
  className = ''
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const { selectedFindings, getSelectedFindings } = useFindingsStore();
  const { showToast } = useUIStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (message.trim() || attachments.length > 0) {
      onSendMessage(message.trim(), attachments);
      setMessage('');
      setAttachments([]);
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

  // Handle file attachment
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files).filter(file => {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast({
          type: 'error',
          message: `File ${file.name} is too large (max 10MB)`
        });
        return false;
      }
      return true;
    });

    setAttachments(prev => [...prev, ...newFiles]);
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (allowAttachments && e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
        setAttachments(prev => [...prev, file]);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to start recording. Please check microphone permissions.'
      });
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      setRecordingTime(0);
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get file icon based on type
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const selectedCount = selectedFindings.size;

  return (
    <div className={`border-t bg-background ${className}`}>
      {/* Typing indicator */}
      {showTypingIndicator && (
        <div className="px-4 py-2 border-b">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>AI is typing...</span>
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

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-b">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
                {getFileIcon(file)}
                <span className="max-w-[150px] truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1"
                  onClick={() => removeAttachment(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-4 py-2 border-b bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording: {formatTime(recordingTime)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopRecording}
              className="ml-auto"
            >
              Stop Recording
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div
        className={`p-4 ${isDragging ? 'bg-muted/50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex gap-2 items-end">
          {/* Attachment button */}
          {allowAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept="image/*,audio/*,.pdf,.txt,.md"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Voice button */}
          {allowVoice && (
            <Button
              variant="ghost"
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={disabled}
              title={isRecording ? 'Stop recording' : 'Start voice recording'}
            >
              {isRecording ? (
                <MicOff className="h-4 w-4 text-red-500" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isRecording}
              className="w-full px-3 py-2 bg-background border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              rows={1}
              style={{ minHeight: '40px' }}
            />
            {message.length > maxLength * 0.9 && (
              <span className="absolute bottom-1 right-1 text-xs text-muted-foreground">
                {message.length}/{maxLength}
              </span>
            )}
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={disabled || (!message.trim() && attachments.length === 0)}
            size="icon"
            title="Send message (Enter)"
          >
            {disabled && showTypingIndicator ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Help text */}
        <div className="mt-2 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
          {allowAttachments && ' • Drag and drop files to attach'}
          {allowVoice && ' • Click mic to record audio'}
        </div>
      </div>
    </div>
  );
}