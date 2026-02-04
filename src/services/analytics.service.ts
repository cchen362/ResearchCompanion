/**
 * Analytics Service - DEPRECATED STUB
 *
 * This service was deprecated in Phase 1 Service Layer Consolidation.
 * This stub exists only to prevent build errors.
 *
 * TODO: Remove this file entirely when dependent components are updated
 */

import type { ResearchFinding, SmartDigest } from '@/types';
import { logger } from '@/utils/logger';

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
    _findings: ResearchFinding[],
    _digest?: SmartDigest
  ): AnalyticsSummary {
    logger.warn('[AnalyticsService] This service is deprecated. Use researchInsightsService instead.');

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
