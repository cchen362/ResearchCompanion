import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Activity,
  Pill,
  Heart,
  Brain,
  TrendingUp,
  MessageCircle,
  Target
} from 'lucide-react';
import { Badge } from './ui/badge';

interface TranscriptionSummaryProps {
  summary: {
    visitSummary: string;
    nextSteps: string[];
    importantMentions: string[];
    sentiment?: 'positive' | 'neutral' | 'concerned';
  };
  transcript?: string;
  duration?: number;
  recordedAt?: number;
  expandable?: boolean;
  className?: string;
}

export function TranscriptionSummary({
  summary,
  transcript,
  duration,
  recordedAt,
  expandable = false,
  className
}: TranscriptionSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(expandable ? [] : ['overview', 'actions', 'mentions'])
  );
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const toggleSection = (section: string) => {
    if (!expandable) return;
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getSentimentBadge = () => {
    const sentimentConfig = {
      positive: {
        label: 'Positive Progress',
        icon: TrendingUp,
        className: 'bg-green-100 text-green-800 border-green-200'
      },
      neutral: {
        label: 'Stable',
        icon: Activity,
        className: 'bg-blue-100 text-blue-800 border-blue-200'
      },
      concerned: {
        label: 'Needs Attention',
        icon: AlertCircle,
        className: 'bg-amber-100 text-amber-800 border-amber-200'
      }
    };

    const config = sentimentConfig[summary.sentiment || 'neutral'];
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${config.className}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">{config.label}</span>
      </div>
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Parse visit summary to extract key information and preserve formatting
  const parseVisitSummary = (summary: string) => {
    // Preserve original line breaks and split into paragraphs
    // Split on double newlines or periods followed by capital letters after proper spacing
    const paragraphs = summary
      .split(/\n\n+/)  // Split on multiple newlines
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // If no paragraphs found, try splitting on sentence boundaries
    if (paragraphs.length === 1) {
      // Split on periods that are followed by a space and capital letter, but preserve the period
      const sentences = summary.match(/[^.!?]+[.!?]+/g) || [summary];

      // Group sentences into logical paragraphs (2-3 sentences each for better readability)
      if (sentences.length > 3) {
        const firstPara = sentences.slice(0, 2).join(' ').trim();
        const secondPara = sentences.slice(2).join(' ').trim();
        return {
          paragraphs: [firstPara, secondPara].filter(p => p.length > 0),
          hasMultipleParagraphs: true
        };
      }
    }

    return {
      paragraphs: paragraphs.length > 0 ? paragraphs : [summary],
      hasMultipleParagraphs: paragraphs.length > 1
    };
  };

  const { paragraphs, hasMultipleParagraphs } = parseVisitSummary(summary.visitSummary);

  // Categorize action items
  const categorizeActionItems = (items: string[]) => {
    const categories = {
      medication: { icon: Pill, items: [], color: 'text-purple-600' },
      followUp: { icon: Calendar, items: [], color: 'text-blue-600' },
      lifestyle: { icon: Heart, items: [], color: 'text-rose-600' },
      monitoring: { icon: Activity, items: [], color: 'text-green-600' },
      other: { icon: CheckCircle, items: [], color: 'text-gray-600' }
    };

    items.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.includes('medication') || lowerItem.includes('prescription') || lowerItem.includes('syrup') || lowerItem.includes('dose')) {
        categories.medication.items.push(item);
      } else if (lowerItem.includes('appointment') || lowerItem.includes('follow') || lowerItem.includes('return') || lowerItem.includes('schedule')) {
        categories.followUp.items.push(item);
      } else if (lowerItem.includes('rest') || lowerItem.includes('hydrat') || lowerItem.includes('diet') || lowerItem.includes('exercise') || lowerItem.includes('water')) {
        categories.lifestyle.items.push(item);
      } else if (lowerItem.includes('monitor') || lowerItem.includes('watch') || lowerItem.includes('symptom') || lowerItem.includes('check')) {
        categories.monitoring.items.push(item);
      } else {
        categories.other.items.push(item);
      }
    });

    return Object.entries(categories)
      .filter(([_, cat]) => cat.items.length > 0)
      .map(([key, cat]) => ({ key, ...cat }));
  };

  const categorizedActions = categorizeActionItems(summary.nextSteps);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Header with metadata */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Stethoscope className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Visit Summary</h3>
          {getSentimentBadge()}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {recordedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateTime(recordedAt)}</span>
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(duration)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary - Always visible */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="space-y-3">
          {paragraphs.map((paragraph, index) => (
            <div key={index}>
              {index === 0 ? (
                // First paragraph - executive summary (slightly larger)
                <p className="text-gray-800 leading-relaxed font-medium">
                  {paragraph}
                </p>
              ) : (
                // Additional paragraphs with visual separation
                <>
                  {index === 1 && hasMultipleParagraphs && (
                    <div className="border-t border-blue-200 mt-3 pt-3" />
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {paragraph}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Items Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('actions')}
          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${expandable ? "cursor-pointer" : ""}`}
          disabled={!expandable}
        >
          <div className="flex items-center gap-2">
            {expandable && (
              expandedSections.has('actions') ?
                <ChevronDown className="w-4 h-4 text-gray-500" /> :
                <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <Target className="w-4 h-4 text-green-600" />
            <span className="font-medium text-gray-900">Action Items</span>
            <Badge variant="secondary" className="ml-2">
              {summary.nextSteps.length}
            </Badge>
          </div>
        </button>

        {(!expandable || expandedSections.has('actions')) && summary.nextSteps.length > 0 && (
          <div className="px-4 pb-4 space-y-3">
            {categorizedActions.map((category) => (
              <div key={category.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <category.icon className={`w-4 h-4 ${category.color}`} />
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {category.key === 'followUp' ? 'Follow-up' : category.key}
                  </span>
                </div>
                <ul className="ml-6 space-y-1">
                  {category.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Important Mentions Section */}
      {summary.importantMentions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('mentions')}
            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${expandable ? "cursor-pointer" : ""}`}
            disabled={!expandable}
          >
            <div className="flex items-center gap-2">
              {expandable && (
                expandedSections.has('mentions') ?
                  <ChevronDown className="w-4 h-4 text-gray-500" /> :
                  <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
              <Brain className="w-4 h-4 text-amber-600" />
              <span className="font-medium text-gray-900">Key Medical Points</span>
              <Badge variant="secondary" className="ml-2">
                {summary.importantMentions.length}
              </Badge>
            </div>
          </button>

          {(!expandable || expandedSections.has('mentions')) && (
            <div className="px-4 pb-4">
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                <div className="space-y-3">
                  {summary.importantMentions.map((mention, idx) => {
                    // Categorize mentions by type based on keywords
                    let icon = AlertCircle;
                    let iconColor = "text-amber-600";
                    const lowerMention = mention.toLowerCase();

                    if (lowerMention.includes('diagnosis') || lowerMention.includes('condition')) {
                      icon = Stethoscope;
                      iconColor = "text-blue-600";
                    } else if (lowerMention.includes('symptom') || lowerMention.includes('pain')) {
                      icon = Activity;
                      iconColor = "text-orange-600";
                    } else if (lowerMention.includes('test') || lowerMention.includes('result') || lowerMention.includes('lab')) {
                      icon = FileText;
                      iconColor = "text-purple-600";
                    } else if (lowerMention.includes('treatment') || lowerMention.includes('medication')) {
                      icon = Pill;
                      iconColor = "text-green-600";
                    }

                    const Icon = icon;

                    return (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Icon className={`w-4 h-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {mention}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Transcript Section */}
      {transcript && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowFullTranscript(!showFullTranscript)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              {showFullTranscript ?
                <ChevronDown className="w-4 h-4 text-gray-500" /> :
                <ChevronRight className="w-4 h-4 text-gray-500" />
              }
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-900">Full Transcript</span>
            </div>
            <span className="text-sm text-gray-500">
              {showFullTranscript ? 'Hide' : 'Show'}
            </span>
          </button>

          {showFullTranscript && (
            <div className="px-4 pb-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {transcript}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}