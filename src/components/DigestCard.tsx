import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  AlertTriangle,
  Lightbulb,
  FileText,
  GraduationCap,
  Brain,
  Database,
  RefreshCw,
  HardDrive,
  Stethoscope,
  BookOpen,
  FlaskConical,
  Shield,
  Globe
} from 'lucide-react';
import type { SmartDigest, DigestTimeframe, ExplanationMode, DualModeText } from '../types';
import { FeaturedDiscovery } from './digest/FeaturedDiscovery';
import { FindingSummaryCard } from './digest/FindingSummaryCard';
import { formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

/** Section IDs for scroll-spy and TOC navigation */
export const DIGEST_SECTION_IDS = {
  header: 'digest-header',
  notableFindings: 'digest-notable-findings',
  takeaways: 'digest-takeaways',
  forYourDoctor: 'digest-for-your-doctor',
  sources: 'digest-sources',
} as const;

/** Resolve a DualModeText object to its technical or explained string */
function resolveText(item: DualModeText, mode: ExplanationMode): string {
  return mode === 'technical' ? item.technical : item.explained;
}

interface DigestCardProps {
  digest: SmartDigest;
  onViewSources: () => void;
  onViewFinding?: (findingId: string) => void;
  onAskQuestion?: (question: string) => void;
  explanationMode: ExplanationMode;
  setExplanationMode: (mode: ExplanationMode) => void;
}

export function DigestCard({
  digest,
  onViewSources,
  onViewFinding,
  onAskQuestion,
  explanationMode,
  setExplanationMode
}: DigestCardProps) {
  const [topFindingsFilter, setTopFindingsFilter] = useState<string>('all');

  // Get cache status information
  const getCacheStatus = () => {
    const meta = digest.cacheMetadata;
    if (!meta) return null;

    if (meta.deduplicated) {
      return {
        icon: Database,
        label: 'Cached Version',
        variant: 'secondary' as const,
        tooltip: 'This digest was retrieved from the database cache to save processing time'
      };
    }

    if (meta.isCached && meta.source === 'postgresql') {
      return {
        icon: Database,
        label: 'From Server',
        variant: 'secondary' as const,
        tooltip: 'Retrieved from server database'
      };
    }

    if (meta.isCached && meta.source === 'indexeddb') {
      return {
        icon: HardDrive,
        label: 'Local Cache',
        variant: 'outline' as const,
        tooltip: 'Retrieved from local browser cache'
      };
    }

    if (meta.source === 'generated') {
      return {
        icon: RefreshCw,
        label: 'Fresh',
        variant: 'default' as const,
        tooltip: 'Newly generated digest with latest AI analysis'
      };
    }

    return null;
  };

  const cacheStatus = getCacheStatus();

  const forYourDoctor = digest.forYourDoctor || { questions: [], watchFor: [], conflicts: [] };
  const hasForYourDoctor = forYourDoctor.questions.length > 0 || forYourDoctor.watchFor.length > 0;

  return (
    <div className="space-y-4">
      {/* Header Card with What's New + Featured Discovery */}
      <Card id={DIGEST_SECTION_IDS.header} className="scroll-mt-24 border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">
                  Research Digest
                </CardTitle>
                {cacheStatus && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={cacheStatus.variant} className="gap-1">
                          <cacheStatus.icon className="h-3 w-3" />
                          {cacheStatus.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{cacheStatus.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-muted)] mb-2">
                Updated {formatDistanceToNow(digest.generatedAt, { addSuffix: true })}
                {digest.cacheMetadata?.deduplicated && (
                  <span className="ml-2 text-primary">
                    • This is a cached version from your previous request
                  </span>
                )}
              </p>
              {digest.cacheMetadata?.lastAgentRun && digest.cacheMetadata.lastAgentRun > digest.generatedAt && (
                <p className="text-xs text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                  Agents last scanned {formatDistanceToNow(digest.cacheMetadata.lastAgentRun, { addSuffix: true })}
                  <span className="mx-1">·</span>
                  No new research found
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExplanationMode(
                  explanationMode === 'technical' ? 'explained' : 'technical'
                )}
                className="gap-2"
              >
                {explanationMode === 'technical' ? (
                  <>
                    <GraduationCap className="h-4 w-4" />
                    Technical
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4" />
                    Explained
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Source Stats Inline */}
            {digest.sourceBreakdown && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[var(--color-text-muted)] font-medium">{digest.statistics.totalFindings} findings:</span>
                {digest.sourceBreakdown.pubmed > 0 && (
                  <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full px-2.5 py-0.5">
                    <BookOpen className="h-3 w-3" />
                    {digest.sourceBreakdown.pubmed} PubMed
                  </span>
                )}
                {digest.sourceBreakdown.clinicalTrials > 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 rounded-full px-2.5 py-0.5">
                    <FlaskConical className="h-3 w-3" />
                    {digest.sourceBreakdown.clinicalTrials} Clinical
                  </span>
                )}
                {digest.sourceBreakdown.fda > 0 && (
                  <span className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 rounded-full px-2.5 py-0.5">
                    <Shield className="h-3 w-3" />
                    {digest.sourceBreakdown.fda} FDA
                  </span>
                )}
                {digest.sourceBreakdown.web > 0 && (
                  <span className="inline-flex items-center gap-1 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] rounded-full px-2.5 py-0.5">
                    <Globe className="h-3 w-3" />
                    {digest.sourceBreakdown.web} Web
                  </span>
                )}
              </div>
            )}

            {/* What's New */}
            {digest.whatsNew && (
              <div className="p-4 bg-[var(--color-surface)]/50 rounded-lg border">
                <p className="text-sm leading-relaxed">
                  {explanationMode === 'technical' ? digest.whatsNew.technical : digest.whatsNew.explained}
                </p>
              </div>
            )}

            {/* Featured Discovery */}
            {digest.featuredDiscovery && (
              <FeaturedDiscovery
                discovery={digest.featuredDiscovery}
                mode={explanationMode}
                onViewSource={(id) => {
                  onViewFinding?.(id);
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notable Findings */}
      {digest.notableFindings && digest.notableFindings.length > 0 && (
        <Card id={DIGEST_SECTION_IDS.notableFindings} className="scroll-mt-24">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notable Findings</CardTitle>
              <span className="text-sm text-[var(--color-text-muted)]">
                {digest.notableFindings.length} of {digest.statistics.totalFindings}
              </span>
            </div>
            {/* Source type filter tabs */}
            <div className="flex gap-1 flex-wrap mt-2">
              <Button
                variant={topFindingsFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setTopFindingsFilter('all')}
              >
                All ({digest.notableFindings.length})
              </Button>
              {(['pubmed', 'clinical_trial', 'fda', 'web'] as const).map((sourceType) => {
                const count = digest.notableFindings.filter(f => f.sourceType === sourceType).length;
                if (count === 0) return null;
                const labels: Record<string, string> = { pubmed: 'PubMed', clinical_trial: 'Clinical', fda: 'FDA', web: 'Web' };
                return (
                  <Button
                    key={sourceType}
                    variant={topFindingsFilter === sourceType ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTopFindingsFilter(sourceType)}
                  >
                    {labels[sourceType]} ({count})
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.notableFindings
              .filter(f => topFindingsFilter === 'all' || f.sourceType === topFindingsFilter)
              .map((finding) => (
              <FindingSummaryCard
                key={finding.findingId}
                finding={finding}
                mode={explanationMode}
                onViewSource={(id) => {
                  onViewFinding?.(id);
                }}
              />
            ))}
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={onViewSources}>
                View all {digest.statistics.totalFindings} findings →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Takeaways */}
      {digest.keyTakeaways.length > 0 && (
        <Card id={DIGEST_SECTION_IDS.takeaways} className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Key Takeaways
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {digest.keyTakeaways.map((takeaway, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span className="text-sm">{resolveText(takeaway, explanationMode)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* For Your Doctor */}
      {hasForYourDoctor && (
        <Card id={DIGEST_SECTION_IDS.forYourDoctor} className="scroll-mt-24 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-blue-600" />
              For Your Doctor
              <Badge variant="secondary" className="ml-2">
                {forYourDoctor.questions.length + forYourDoctor.watchFor.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
              {/* Questions to Ask */}
              {forYourDoctor.questions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-blue-700 dark:text-blue-300">
                    Questions to Ask
                  </h4>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">
                    Use these evidence-based questions at your next appointment.
                  </p>
                  <div className="space-y-2">
                    {forYourDoctor.questions.map((question, index) => (
                      <div
                        key={index}
                        className="p-3 bg-[var(--color-surface)]/80 rounded-md border border-[var(--color-border)]/50"
                      >
                        <p className="text-sm leading-relaxed">
                          "{resolveText(question, explanationMode)}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Watch For */}
              {forYourDoctor.watchFor.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    Watch For
                  </h4>
                  <div className="space-y-2">
                    {forYourDoctor.watchFor.map((sign, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-md"
                      >
                        <span className="text-amber-600 mt-0.5">●</span>
                        <p className="text-sm leading-relaxed">
                          {resolveText(sign, explanationMode)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] italic mt-3">
                    If you experience any of these symptoms, contact your healthcare provider promptly.
                  </p>
                </div>
              )}

              {/* Conflicting Findings */}
              {forYourDoctor.conflicts && forYourDoctor.conflicts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                    <AlertTriangle className="h-4 w-4" />
                    Conflicting Findings
                  </h4>
                  <div className="space-y-3">
                    {forYourDoctor.conflicts.map((conflict, index) => (
                      <div
                        key={index}
                        className="p-3 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900"
                      >
                        <h5 className="font-semibold text-sm mb-2">
                          {resolveText(conflict.topic, explanationMode)}
                        </h5>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {resolveText(conflict.explanation, explanationMode)}
                        </p>
                        {conflict.sources.length > 0 && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            Sources: {conflict.sources.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
        </Card>
      )}

      {/* View All Sources Button */}
      <div id={DIGEST_SECTION_IDS.sources} className="scroll-mt-24 flex justify-center">
        <Button
          variant="outline"
          onClick={onViewSources}
          className="w-full sm:w-auto"
        >
          <FileText className="h-4 w-4 mr-2" />
          View All Sources
        </Button>
      </div>
    </div>
  );
}
