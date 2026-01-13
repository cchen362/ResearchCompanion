import React, { useState } from 'react';
import { X, Download, Share2, Edit2, Check, Calendar, Clock, FileText, Printer } from 'lucide-react';
import { TranscriptionSummary } from './TranscriptionSummary';
import { updateTimelineEvent } from '@/utils/db/timeline';
import type { TimelineEvent } from '@/types';

interface RecordingDetailModalProps {
  recording: TimelineEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function RecordingDetailModal({ recording, isOpen, onClose, onUpdate }: RecordingDetailModalProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  if (!isOpen || !recording) return null;

  const data = recording.data as any;
  const recordingDate = new Date(recording.timestamp);

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== recording.title) {
      try {
        await updateTimelineEvent({
          ...recording,
          title: editedTitle.trim()
        });
        setIsEditingTitle(false);
        if (onUpdate) {
          onUpdate();
        }
      } catch (error) {
        console.error('Error updating title:', error);
      }
    } else {
      setIsEditingTitle(false);
    }
  };

  const handleExport = () => {
    // Create a formatted text version
    const exportContent = `
MEDICAL VISIT RECORDING
========================
Title: ${recording.title}
Date: ${recordingDate.toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}
Time: ${recordingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
Duration: ${data.duration ? `${Math.floor(data.duration / 60)}:${(data.duration % 60).toString().padStart(2, '0')}` : 'N/A'}

VISIT SUMMARY
=============
${data.summary?.visitSummary || 'No summary available'}

ACTION ITEMS
============
${data.summary?.nextSteps?.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n') || 'No action items'}

IMPORTANT POINTS
================
${data.summary?.importantMentions?.map((mention: string, i: number) => `• ${mention}`).join('\n') || 'No important mentions'}

FULL TRANSCRIPT
===============
${data.transcript || 'No transcript available'}
    `;

    // Create and download the file
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visit-${recordingDate.toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: recording.title,
          text: `Visit Summary: ${data.summary?.visitSummary?.substring(0, 200)}...`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(`${recording.title}\n\n${data.summary?.visitSummary}`);
      alert('Summary copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    className="flex-1 text-xl font-semibold text-gray-900 border-b-2 border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-900">{recording.title}</h2>
                  <button
                    onClick={() => {
                      setEditedTitle(recording.title);
                      setIsEditingTitle(true);
                    }}
                    className="text-gray-400 hover:text-indigo-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {recordingDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {recordingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {data.duration && (
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {data.summary ? (
            <TranscriptionSummary
              summary={data.summary}
              transcript={data.transcript}
              duration={data.duration}
              recordedAt={data.recordedAt || recording.timestamp}
              expandable={false}
            />
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No summary available for this recording</p>
              {data.transcript && (
                <div className="mt-6 text-left">
                  <h3 className="font-medium text-gray-900 mb-3">Transcript</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                    {data.transcript}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}