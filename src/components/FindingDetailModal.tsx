import React from 'react';
import { X, Calendar, ExternalLink, Tag, FileText } from 'lucide-react';
import { Button } from './ui/button';

interface FindingDetailModalProps {
  finding: any;
  isOpen: boolean;
  onClose: () => void;
}

export function FindingDetailModal({ finding, isOpen, onClose }: FindingDetailModalProps) {
  if (!isOpen || !finding) return null;

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'Unknown date';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case 'pubmed':
        return '📚';
      case 'clinical':
        return '🔬';
      case 'web':
        return '🌐';
      default:
        return '📄';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">
              {finding.title || 'Research Finding'}
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                {getSourceTypeIcon(finding.source?.type || 'research')}
                {finding.source?.displayName || finding.source?.name || 'Unknown Source'}
              </span>
              {finding.source?.journal && (
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {finding.source.journal}
                </span>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="ml-4"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary if available */}
          {finding.summary && finding.summary !== finding.content && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Summary</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{finding.summary}</p>
            </div>
          )}

          {/* Main Content */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Details</h3>
            <div className="text-gray-700 whitespace-pre-wrap">
              {finding.content || 'No additional details available.'}
            </div>
          </div>

          {/* Metadata */}
          <div className="border-t pt-4 space-y-3">
            {/* Date */}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Published:</span>
              <span>{formatDate(finding.source?.publishDate || finding.createdAt)}</span>
            </div>

            {/* Tags */}
            {finding.tags && finding.tags.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {finding.tags.map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source URL */}
            {finding.source?.url && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Source:</span>
                <a
                  href={finding.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  View original source
                </a>
              </div>
            )}

            {/* Category/Type */}
            {finding.category && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Category:</span>
                <span className="capitalize">{finding.category}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t p-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          {finding.source?.url && (
            <Button
              onClick={() => window.open(finding.source.url, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Source
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}