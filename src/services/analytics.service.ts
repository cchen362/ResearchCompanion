/**
 * Analytics Service - DEPRECATED STUB
 *
 * This service was deprecated in Phase 1 Service Layer Consolidation.
 * This stub exists only to prevent build errors.
 * Components using this service will be refactored in Phase 3.
 *
 * TODO: Remove in Phase 3 (Component Decomposition)
 */

import type { ResearchFinding, TimelineEvent, SmartDigest } from '@/types';

// Type exports for backward compatibility
export interface SymptomCorrelation {
  symptom: string;
  relatedSymptoms: string[];
  correlation: number;
  timePattern: string;
}

export interface TreatmentEffectiveness {
  treatment: string;
  overallEffectiveness: number;
  conditions: string[];
  sideEffects: string[];
}

export interface PatternAnalysis {
  patterns: {
    type: string;
    description: string;
    frequency: string;
  }[];
  trends: string[];
}

export interface ResearchInsight {
  type: 'correlation' | 'breakthrough' | 'warning' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
}

interface AnalyticsSummary {
  correlations: SymptomCorrelation[];
  effectiveness: TreatmentEffectiveness[];
  patterns: PatternAnalysis;
  insights: ResearchInsight[];
}

class AnalyticsService {
  /**
   * @deprecated This service is deprecated. Use researchInsightsService instead.
   * This stub returns empty data to prevent build errors.
   */
  generateAnalyticsSummary(
    _timeline: TimelineEvent[],
    _findings: ResearchFinding[],
    _digest?: SmartDigest
  ): AnalyticsSummary {
    console.warn('[AnalyticsService] This service is deprecated. Use researchInsightsService instead.');

    return {
      correlations: [],
      effectiveness: [],
      patterns: {
        patterns: [],
        trends: []
      },
      insights: []
    };
  }
}

export const analyticsService = new AnalyticsService();
