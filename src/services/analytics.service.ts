import type { ResearchFinding, TimelineEvent, SmartDigest } from '@/types';
import { differenceInDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Analytics Service - Phase 3A Implementation
 * Handles pattern detection, correlation analysis, and treatment effectiveness tracking
 */

export interface SymptomCorrelation {
  symptom1: string;
  symptom2: string;
  correlation: number; // -1 to 1 (negative = inverse correlation)
  confidence: number; // 0 to 1
  occurrences: number;
  temporalRelation: 'concurrent' | 'sequential' | 'independent';
  averageDaysBetween?: number;
}

export interface TreatmentEffectiveness {
  treatmentName: string;
  startDate: Date;
  endDate?: Date;
  symptomChanges: Array<{
    symptom: string;
    beforeSeverity: number;
    afterSeverity: number;
    improvement: number; // percentage
    daysToImprovement: number;
  }>;
  overallEffectiveness: number; // 0-100
  confidenceLevel: number; // 0-100
  sideEffects: string[];
  breakthroughs: Array<{
    date: Date;
    description: string;
    impact: 'major' | 'moderate' | 'minor';
  }>;
}

export interface PatternAnalysis {
  patterns: Array<{
    type: 'cyclical' | 'progressive' | 'episodic' | 'stable';
    description: string;
    confidence: number;
    affectedSymptoms: string[];
    periodDays?: number; // for cyclical patterns
    trend?: 'improving' | 'worsening' | 'stable'; // for progressive patterns
  }>;
  triggers: Array<{
    trigger: string;
    relatedSymptoms: string[];
    averageDelayDays: number;
    confidence: number;
  }>;
  clusters: Array<{
    symptoms: string[];
    occurrenceCount: number;
    averageDuration: number;
  }>;
}

export interface ResearchInsight {
  type: 'breakthrough' | 'contradiction' | 'confirmation' | 'gap';
  title: string;
  description: string;
  relatedFindings: string[]; // Finding IDs
  confidence: number;
  temporalContext?: {
    when: Date;
    relevantEvents: TimelineEvent[];
  };
}

class AnalyticsService {
  /**
   * Analyze symptom correlations from timeline events
   */
  analyzeSymptomCorrelations(
    events: TimelineEvent[],
    windowDays: number = 7
  ): SymptomCorrelation[] {
    const correlations: Map<string, SymptomCorrelation> = new Map();
    const symptomEvents = events.filter(e => e.type === 'symptom');

    // Group symptoms by time windows
    const timeWindows: Map<string, TimelineEvent[]> = new Map();
    symptomEvents.forEach(event => {
      const eventDate = new Date(event.date);
      const windowKey = startOfDay(eventDate).toISOString();
      if (!timeWindows.has(windowKey)) {
        timeWindows.set(windowKey, []);
      }
      timeWindows.get(windowKey)!.push(event);
    });

    // Analyze co-occurrences
    symptomEvents.forEach((event1, i) => {
      symptomEvents.slice(i + 1).forEach(event2 => {
        const date1 = new Date(event1.date);
        const date2 = new Date(event2.date);
        const daysDiff = Math.abs(differenceInDays(date1, date2));

        if (daysDiff <= windowDays) {
          const key = [event1.description, event2.description].sort().join('::');

          if (!correlations.has(key)) {
            correlations.set(key, {
              symptom1: event1.description,
              symptom2: event2.description,
              correlation: 0,
              confidence: 0,
              occurrences: 0,
              temporalRelation: 'independent',
              averageDaysBetween: 0
            });
          }

          const corr = correlations.get(key)!;
          corr.occurrences++;
          corr.averageDaysBetween =
            (corr.averageDaysBetween * (corr.occurrences - 1) + daysDiff) / corr.occurrences;

          // Determine temporal relation
          if (daysDiff === 0) {
            corr.temporalRelation = 'concurrent';
          } else if (daysDiff <= 3) {
            corr.temporalRelation = 'sequential';
          }

          // Calculate correlation strength
          const severityCorrelation = this.calculateSeverityCorrelation(event1, event2);
          corr.correlation =
            (corr.correlation * (corr.occurrences - 1) + severityCorrelation) / corr.occurrences;

          // Update confidence based on sample size
          corr.confidence = Math.min(corr.occurrences / 10, 1);
        }
      });
    });

    return Array.from(correlations.values())
      .filter(c => c.occurrences >= 2) // Minimum 2 occurrences
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate correlation between symptom severities
   */
  private calculateSeverityCorrelation(event1: TimelineEvent, event2: TimelineEvent): number {
    const severity1 = this.severityToNumber(event1.severity);
    const severity2 = this.severityToNumber(event2.severity);

    // Simple correlation: both high or both low = positive
    if ((severity1 >= 7 && severity2 >= 7) || (severity1 <= 3 && severity2 <= 3)) {
      return 0.8;
    }
    // One high, one low = negative correlation
    if ((severity1 >= 7 && severity2 <= 3) || (severity1 <= 3 && severity2 >= 7)) {
      return -0.6;
    }
    // Mixed = weak correlation
    return 0.2;
  }

  /**
   * Convert severity string to number
   */
  private severityToNumber(severity?: string): number {
    switch (severity?.toLowerCase()) {
      case 'severe': return 9;
      case 'high': return 8;
      case 'moderate': return 5;
      case 'mild': return 3;
      case 'low': return 2;
      default: return 5;
    }
  }

  /**
   * Track treatment effectiveness over time
   */
  trackTreatmentEffectiveness(
    treatmentEvents: TimelineEvent[],
    symptomEvents: TimelineEvent[],
    findings: ResearchFinding[] = []
  ): TreatmentEffectiveness[] {
    const treatments = treatmentEvents.filter(e => e.type === 'treatment');
    const effectiveness: TreatmentEffectiveness[] = [];

    treatments.forEach(treatment => {
      const treatmentDate = new Date(treatment.date);

      // Find symptoms before and after treatment
      const beforeSymptoms = symptomEvents.filter(s => {
        const symptomDate = new Date(s.date);
        const daysDiff = differenceInDays(treatmentDate, symptomDate);
        return daysDiff <= 30 && daysDiff >= 0;
      });

      const afterSymptoms = symptomEvents.filter(s => {
        const symptomDate = new Date(s.date);
        const daysDiff = differenceInDays(symptomDate, treatmentDate);
        return daysDiff <= 30 && daysDiff > 0;
      });

      // Calculate symptom changes
      const symptomChanges: TreatmentEffectiveness['symptomChanges'] = [];
      const symptomMap = new Map<string, { before: number[], after: number[] }>();

      beforeSymptoms.forEach(s => {
        if (!symptomMap.has(s.description)) {
          symptomMap.set(s.description, { before: [], after: [] });
        }
        symptomMap.get(s.description)!.before.push(this.severityToNumber(s.severity));
      });

      afterSymptoms.forEach(s => {
        if (!symptomMap.has(s.description)) {
          symptomMap.set(s.description, { before: [], after: [] });
        }
        symptomMap.get(s.description)!.after.push(this.severityToNumber(s.severity));
      });

      // Calculate improvements
      symptomMap.forEach((data, symptom) => {
        if (data.before.length > 0 && data.after.length > 0) {
          const avgBefore = data.before.reduce((a, b) => a + b, 0) / data.before.length;
          const avgAfter = data.after.reduce((a, b) => a + b, 0) / data.after.length;
          const improvement = ((avgBefore - avgAfter) / avgBefore) * 100;

          symptomChanges.push({
            symptom,
            beforeSeverity: avgBefore,
            afterSeverity: avgAfter,
            improvement: Math.max(0, improvement),
            daysToImprovement: afterSymptoms.find(s => s.description === symptom)
              ? differenceInDays(
                  new Date(afterSymptoms.find(s => s.description === symptom)!.date),
                  treatmentDate
                )
              : 0
          });
        }
      });

      // Identify breakthroughs from findings
      const treatmentTimestamp = treatmentDate.getTime();
      const thirtyDaysLater = treatmentTimestamp + 30 * 24 * 60 * 60 * 1000;

      const breakthroughs = findings
        .filter(f =>
          f.timestamp >= treatmentTimestamp &&
          f.timestamp <= thirtyDaysLater &&
          f.relevanceScore >= 8
        )
        .map(f => ({
          date: new Date(f.timestamp),
          description: f.title,
          impact: f.relevanceScore >= 9 ? 'major' as const : 'moderate' as const
        }));

      // Calculate overall effectiveness
      const overallEffectiveness = symptomChanges.length > 0
        ? symptomChanges.reduce((sum, sc) => sum + sc.improvement, 0) / symptomChanges.length
        : 0;

      effectiveness.push({
        treatmentName: treatment.description,
        startDate: treatmentDate,
        endDate: treatment.endDate,
        symptomChanges,
        overallEffectiveness: Math.min(100, Math.max(0, overallEffectiveness)),
        confidenceLevel: Math.min(100, symptomChanges.length * 20), // More data = higher confidence
        sideEffects: this.extractSideEffects(treatment, symptomEvents),
        breakthroughs
      });
    });

    return effectiveness.sort((a, b) => b.overallEffectiveness - a.overallEffectiveness);
  }

  /**
   * Extract potential side effects
   */
  private extractSideEffects(
    treatment: TimelineEvent,
    symptomEvents: TimelineEvent[]
  ): string[] {
    // New symptoms that appeared after treatment
    const treatmentDate = new Date(treatment.date);
    const afterTreatment = symptomEvents.filter(s => {
      const symptomDate = new Date(s.date);
      const daysDiff = differenceInDays(symptomDate, treatmentDate);
      return daysDiff <= 14 && daysDiff > 0 &&
        s.severity && ['moderate', 'severe'].includes(s.severity);
    });

    return [...new Set(afterTreatment.map(s => s.description))];
  }

  /**
   * Detect patterns in timeline data
   */
  detectPatterns(events: TimelineEvent[]): PatternAnalysis {
    const symptomEvents = events
      .filter(e => e.type === 'symptom')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const patterns: PatternAnalysis['patterns'] = [];
    const triggers: PatternAnalysis['triggers'] = [];
    const clusters: PatternAnalysis['clusters'] = [];

    // Detect cyclical patterns
    const symptomFrequency = new Map<string, Date[]>();
    symptomEvents.forEach(event => {
      if (!symptomFrequency.has(event.description)) {
        symptomFrequency.set(event.description, []);
      }
      symptomFrequency.get(event.description)!.push(new Date(event.date));
    });

    symptomFrequency.forEach((dates, symptom) => {
      if (dates.length >= 3) {
        const intervals = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push(differenceInDays(dates[i], dates[i - 1]));
        }

        // Check for regular intervals
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev < avgInterval * 0.3) { // Low variance = cyclical
          patterns.push({
            type: 'cyclical',
            description: `${symptom} occurs approximately every ${Math.round(avgInterval)} days`,
            confidence: Math.max(0.5, 1 - (stdDev / avgInterval)),
            affectedSymptoms: [symptom],
            periodDays: Math.round(avgInterval)
          });
        }
      }
    });

    // Detect progressive patterns (worsening/improving over time)
    symptomFrequency.forEach((dates, symptom) => {
      const severities = symptomEvents
        .filter(e => e.description === symptom && e.severity)
        .map(e => ({ date: new Date(e.date), severity: this.severityToNumber(e.severity) }));

      if (severities.length >= 3) {
        const firstHalf = severities.slice(0, Math.floor(severities.length / 2));
        const secondHalf = severities.slice(Math.floor(severities.length / 2));

        const avgFirst = firstHalf.reduce((sum, s) => sum + s.severity, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((sum, s) => sum + s.severity, 0) / secondHalf.length;

        if (Math.abs(avgSecond - avgFirst) > 2) {
          patterns.push({
            type: 'progressive',
            description: `${symptom} is ${avgSecond > avgFirst ? 'worsening' : 'improving'} over time`,
            confidence: Math.min(0.9, Math.abs(avgSecond - avgFirst) / 10),
            affectedSymptoms: [symptom],
            trend: avgSecond > avgFirst ? 'worsening' : 'improving'
          });
        }
      }
    });

    // Detect symptom clusters (symptoms that occur together)
    const clusterMap = new Map<string, number>();
    const windowSize = 3; // days

    for (let i = 0; i < symptomEvents.length; i++) {
      const currentEventDate = new Date(symptomEvents[i].date);
      const window = symptomEvents.filter(e => {
        const eventDate = new Date(e.date);
        return Math.abs(differenceInDays(eventDate, currentEventDate)) <= windowSize;
      });

      if (window.length >= 2) {
        const clusterKey = window
          .map(e => e.description)
          .sort()
          .join('::');

        clusterMap.set(clusterKey, (clusterMap.get(clusterKey) || 0) + 1);
      }
    }

    clusterMap.forEach((count, key) => {
      if (count >= 2) {
        const symptoms = key.split('::');
        clusters.push({
          symptoms,
          occurrenceCount: count,
          averageDuration: windowSize
        });
      }
    });

    // Detect triggers (events followed by symptoms)
    const allEvents = events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const triggerCandidates = allEvents.filter(e =>
      e.type === 'treatment' || e.type === 'diagnosis' || e.tags?.includes('trigger')
    );

    triggerCandidates.forEach(trigger => {
      const triggerDate = new Date(trigger.date);
      const followingSymptoms = symptomEvents.filter(s => {
        const symptomDate = new Date(s.date);
        const daysDiff = differenceInDays(symptomDate, triggerDate);
        return daysDiff <= 7 && daysDiff > 0;
      });

      if (followingSymptoms.length > 0) {
        triggers.push({
          trigger: trigger.description,
          relatedSymptoms: [...new Set(followingSymptoms.map(s => s.description))],
          averageDelayDays: followingSymptoms.reduce((sum, s) =>
            sum + differenceInDays(new Date(s.date), triggerDate), 0
          ) / followingSymptoms.length,
          confidence: Math.min(0.9, followingSymptoms.length / 5)
        });
      }
    });

    return { patterns, triggers, clusters };
  }

  /**
   * Extract research insights by comparing findings with timeline
   */
  extractResearchInsights(
    findings: ResearchFinding[],
    timeline: TimelineEvent[],
    digest?: SmartDigest
  ): ResearchInsight[] {
    const insights: ResearchInsight[] = [];

    // Identify breakthroughs (high-relevance findings near improvement events)
    const improvements = timeline.filter(e =>
      e.tags?.includes('improvement') || e.notes?.toLowerCase().includes('better')
    );

    improvements.forEach(improvement => {
      const improvementDate = new Date(improvement.date);
      const relevantFindings = findings.filter(f => {
        const findingDate = new Date(f.timestamp);
        return Math.abs(differenceInDays(findingDate, improvementDate)) <= 30 &&
          f.relevanceScore >= 8;
      });

      if (relevantFindings.length > 0) {
        insights.push({
          type: 'breakthrough',
          title: `Potential breakthrough around ${improvementDate.toLocaleDateString()}`,
          description: `High-relevance research findings coincide with reported improvement in ${improvement.description}`,
          relatedFindings: relevantFindings.map(f => f.id),
          confidence: Math.min(0.95, relevantFindings.length / 3),
          temporalContext: {
            when: improvementDate,
            relevantEvents: [improvement]
          }
        });
      }
    });

    // Identify contradictions from digest
    if (digest?.contradictions) {
      digest.contradictions.forEach(contradiction => {
        insights.push({
          type: 'contradiction',
          title: 'Conflicting Research Evidence',
          description: contradiction.description,
          relatedFindings: contradiction.findingIds || [],
          confidence: contradiction.severity === 'high' ? 0.9 : 0.7
        });
      });
    }

    // Identify knowledge gaps
    if (digest?.knowledgeGaps) {
      digest.knowledgeGaps.forEach(gap => {
        insights.push({
          type: 'gap',
          title: 'Research Gap Identified',
          description: gap,
          relatedFindings: [],
          confidence: 0.6
        });
      });
    }

    // Identify confirmations (multiple findings supporting same conclusion)
    const findingsByTheme = new Map<string, ResearchFinding[]>();
    findings.forEach(finding => {
      const theme = finding.category || 'uncategorized';
      if (!findingsByTheme.has(theme)) {
        findingsByTheme.set(theme, []);
      }
      findingsByTheme.get(theme)!.push(finding);
    });

    findingsByTheme.forEach((themeFindings, theme) => {
      if (themeFindings.length >= 3) {
        const avgRelevance = themeFindings.reduce((sum, f) => sum + f.relevanceScore, 0) / themeFindings.length;
        if (avgRelevance >= 7) {
          insights.push({
            type: 'confirmation',
            title: `Strong consensus on ${theme}`,
            description: `Multiple high-quality studies confirm findings related to ${theme}`,
            relatedFindings: themeFindings.map(f => f.id),
            confidence: Math.min(0.95, themeFindings.length / 5)
          });
        }
      }
    });

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate analytics summary
   */
  generateAnalyticsSummary(
    events: TimelineEvent[],
    findings: ResearchFinding[],
    digest?: SmartDigest
  ): {
    correlations: SymptomCorrelation[];
    effectiveness: TreatmentEffectiveness[];
    patterns: PatternAnalysis;
    insights: ResearchInsight[];
  } {
    const symptomEvents = events.filter(e => e.type === 'symptom');
    const treatmentEvents = events.filter(e => e.type === 'treatment');

    return {
      correlations: this.analyzeSymptomCorrelations(events),
      effectiveness: this.trackTreatmentEffectiveness(treatmentEvents, symptomEvents, findings),
      patterns: this.detectPatterns(events),
      insights: this.extractResearchInsights(findings, events, digest)
    };
  }
}

export const analyticsService = new AnalyticsService();