import React, { useEffect } from 'react';
import { X, ExternalLink, Calendar, Shield, Users, FileText, AlertCircle, TrendingUp } from 'lucide-react';
import { findingsService } from '@/services/findings.service';
import type { Finding } from '@/types';

interface FindingDetailDrawerProps {
  finding: Finding | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToChat?: (finding: Finding) => void;
}

export function FindingDetailDrawer({ finding, isOpen, onClose, onAddToChat }: FindingDetailDrawerProps) {
  // Mark finding as read when drawer opens
  useEffect(() => {
    if (isOpen && finding && finding.isNew) {
      findingsService.markFindingAsRead(finding.id).catch(() => {
        // Silent fail — marking as read is not critical
      });
    }
  }, [isOpen, finding?.id]);

  if (!finding) return null;

  // Extract study details from metadata
  const studyDetails = {
    type: finding.metadata?.studyType || 'Research Study',
    participants: finding.metadata?.sampleSize || 'Not specified',
    duration: finding.metadata?.duration || 'Not specified',
    location: finding.metadata?.location || finding.source.displayName || 'Research Database',
    publicationDate: finding.publishedAt ? new Date(finding.publishedAt).toLocaleDateString() : 'Recent',
    doi: finding.metadata?.doi,
    pubmedId: finding.metadata?.pubmedId,
  };

  // Deprecated confidence and relevance metrics removed - not appropriate for medical information

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full md:w-[500px] bg-white shadow-xl transform transition-transform z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 pr-4">
                  {finding.title}
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  {finding.isNew && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      New
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Key Finding */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Key Finding
              </h3>
              <p className="text-blue-800">
                {finding.summary || finding.snippet}
              </p>
            </div>

            {/* Study Details */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Study Information</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <span className="text-sm text-gray-600">Study Type:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{studyDetails.type}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <span className="text-sm text-gray-600">Participants:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{studyDetails.participants}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <span className="text-sm text-gray-600">Published:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{studyDetails.publicationDate}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <span className="text-sm text-gray-600">Source:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{finding.source.displayName || 'Research Database'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Implications */}
            {finding.clinicalImplications && (
              <div className="border-l-4 border-amber-400 bg-amber-50 p-4">
                <h3 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Clinical Implications
                </h3>
                <p className="text-amber-800 text-sm">
                  {finding.clinicalImplications}
                </p>
              </div>
            )}

            {/* Limitations */}
            {finding.limitations && finding.limitations.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Study Limitations</h3>
                <ul className="list-disc list-inside space-y-1">
                  {finding.limitations.map((limitation, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Keywords */}
            {finding.keywords && finding.keywords.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Related Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {finding.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source Links */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Access Full Study</h3>
              <div className="space-y-2">
                {finding.source?.url && (
                  <a
                    href={finding.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm">View on {finding.source.displayName || 'Research Database'}</span>
                  </a>
                )}
                {studyDetails.doi && (
                  <a
                    href={`https://doi.org/${studyDetails.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm">DOI: {studyDetails.doi}</span>
                  </a>
                )}
                {studyDetails.pubmedId && (
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${studyDetails.pubmedId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm">PubMed: {studyDetails.pubmedId}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex gap-3">
              {onAddToChat && (
                <button
                  onClick={() => {
                    onAddToChat(finding);
                    onClose();
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Ask Questions About This
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}