import type { ResearchFinding, SmartDigest, Topic } from '@/types';
import { differenceInDays, format, startOfWeek, startOfMonth } from 'date-fns';

/**
 * Research Insights Service - Clean & Factual Metrics Only
 * No arbitrary scores, categories, or priorities
 * Aligns with "Facts, Not Scores™" principle
 */

export interface ResearchMetrics {
  // Core factual counts
  totalFindings: number;
  uniqueSources: number;
  totalTopics: number;

  // Finding type distribution (using actual finding.type field)
  findingsByType: {
    type: string;
    count: number;
    percentage: number;
  }[];

  // Source distribution (factual)
  sourceDistribution: {
    source: string;
    count: number;
    lastAccessed: Date;
    findingTypes: string[]; // What types of findings from this source
  }[];

  // Activity timeline (factual)
  activityTimeline: {
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    older: number;
  };

  // Research velocity
  findingsPerWeek: number;
  researchDuration: {
    days: number;
    startDate: Date | null;
    endDate: Date | null;
  };

  // Most productive period
  mostProductivePeriod: {
    start: Date;
    end: Date;
    count: number;
  } | null;
}

export interface DigestInsights {
  latestDigest: SmartDigest | null;
  breakthroughs: Array<{
    id: string;
    finding: string;
    significance: string;
  }>;
  knowledgeGaps: string[];
  contradictions: Array<{
    id: string;
    topic: string;
    claimA: string;
    claimB: string;
  }>;
}

export interface ResearchActivity {
  recentFindings: {
    date: string;
    count: number;
    types: string[];
  }[];
  agentActivity: {
    agentName: string;
    lastRun: Date;
    findingsGenerated: number;
  }[];
}

class ResearchInsightsService {
  /**
   * Calculate clean, factual research metrics
   */
  calculateResearchMetrics(
    findings: ResearchFinding[],
    topics: Topic[]
  ): ResearchMetrics {
    // Core counts
    const totalFindings = findings.length;
    const totalTopics = topics.length;

    // Get unique sources
    const sourceMap = new Map<string, {
      count: number;
      lastAccessed: Date;
      types: Set<string>;
    }>();

    findings.forEach(finding => {
      const sourceName = finding.source?.displayName || finding.source?.name || 'Unknown Source';

      if (!sourceMap.has(sourceName)) {
        sourceMap.set(sourceName, {
          count: 0,
          lastAccessed: new Date(finding.timestamp || finding.createdAt || Date.now()),
          types: new Set()
        });
      }

      const source = sourceMap.get(sourceName)!;
      source.count++;
      source.lastAccessed = new Date(Math.max(
        source.lastAccessed.getTime(),
        new Date(finding.timestamp || finding.createdAt || Date.now()).getTime()
      ));

      // Add finding type
      if (finding.type) {
        source.types.add(finding.type);
      }
    });

    // Build source distribution
    const sourceDistribution = Array.from(sourceMap.entries())
      .map(([name, data]) => ({
        source: name,
        count: data.count,
        lastAccessed: data.lastAccessed,
        findingTypes: Array.from(data.types)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 sources

    // Finding type distribution
    const typeMap = new Map<string, number>();
    findings.forEach(f => {
      const type = f.type || 'research';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const findingsByType = Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type: this.formatFindingType(type),
        count,
        percentage: Math.round((count / totalFindings) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // Activity timeline
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activityTimeline = {
      thisWeek: 0,
      lastWeek: 0,
      thisMonth: 0,
      older: 0
    };

    findings.forEach(f => {
      const date = new Date(f.timestamp || f.createdAt || Date.now());
      if (date >= oneWeekAgo) {
        activityTimeline.thisWeek++;
      } else if (date >= twoWeeksAgo) {
        activityTimeline.lastWeek++;
      } else if (date >= oneMonthAgo) {
        activityTimeline.thisMonth++;
      } else {
        activityTimeline.older++;
      }
    });

    // Research duration and velocity
    let researchDuration = { days: 0, startDate: null as Date | null, endDate: null as Date | null };
    let findingsPerWeek = 0;

    if (findings.length > 0) {
      const dates = findings.map(f => new Date(f.timestamp || f.createdAt || Date.now()));
      const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const days = differenceInDays(endDate, startDate) + 1;

      researchDuration = { days, startDate, endDate };
      findingsPerWeek = Math.round((findings.length / Math.max(days / 7, 1)) * 10) / 10;
    }

    // Most productive period (week)
    const mostProductivePeriod = this.findMostProductiveWeek(findings);

    return {
      totalFindings,
      uniqueSources: sourceDistribution.length,
      totalTopics,
      findingsByType,
      sourceDistribution,
      activityTimeline,
      findingsPerWeek,
      researchDuration,
      mostProductivePeriod
    };
  }

  /**
   * Extract insights from digests
   */
  extractDigestInsights(digests: SmartDigest[]): DigestInsights {
    const latestDigest = digests.length > 0
      ? digests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;

    if (!latestDigest) {
      return {
        latestDigest: null,
        breakthroughs: [],
        knowledgeGaps: [],
        contradictions: []
      };
    }

    // Extract breakthroughs
    const breakthroughs = (latestDigest.breakthroughs || []).map(b => ({
      id: b.id,
      finding: b.title.technical,
      significance: b.description.technical,
      impact: b.impact
    }));

    // Extract knowledge gaps
    const knowledgeGaps = latestDigest.knowledgeGaps || [];

    // Extract contradictions
    const contradictions = (latestDigest.contradictions || []).map(c => ({
      id: c.id,
      topic: c.topic.technical,
      claimA: c.findingA.claim.technical,
      claimB: c.findingB.claim.technical
    }));

    return {
      latestDigest,
      breakthroughs,
      knowledgeGaps,
      contradictions
    };
  }

  /**
   * Get research activity summary
   */
  getResearchActivity(findings: ResearchFinding[]): ResearchActivity {
    // Group recent findings by day
    const recentDays = 7;
    const dayMap = new Map<string, { count: number; types: Set<string> }>();

    const now = new Date();
    for (let i = 0; i < recentDays; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = format(date, 'yyyy-MM-dd');
      dayMap.set(dateKey, { count: 0, types: new Set() });
    }

    findings.forEach(f => {
      const date = new Date(f.timestamp || f.createdAt || Date.now());
      const dateKey = format(date, 'yyyy-MM-dd');

      if (dayMap.has(dateKey)) {
        const day = dayMap.get(dateKey)!;
        day.count++;
        if (f.type) {
          day.types.add(f.type);
        }
      }
    });

    const recentFindings = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        types: Array.from(data.types)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Group by agent type instead of agent ID for consolidated view
    const agentMap = new Map<string, { lastRun: Date; count: number }>();

    findings.forEach(f => {
      // Use agentType for grouping, fallback to generic if not present
      const agentType = f.agentType || 'general';

      if (!agentMap.has(agentType)) {
        agentMap.set(agentType, {
          lastRun: new Date(f.timestamp || f.createdAt || Date.now()),
          count: 0
        });
      }

      const agent = agentMap.get(agentType)!;
      agent.count++;
      agent.lastRun = new Date(Math.max(
        agent.lastRun.getTime(),
        new Date(f.timestamp || f.createdAt || Date.now()).getTime()
      ));
    });

    const agentActivity = Array.from(agentMap.entries())
      .map(([agentType, data]) => ({
        agentName: this.formatAgentType(agentType),
        lastRun: data.lastRun,
        findingsGenerated: data.count
      }))
      .sort((a, b) => b.lastRun.getTime() - a.lastRun.getTime());

    return {
      recentFindings,
      agentActivity
    };
  }

  // Helper methods
  private formatFindingType(type: string): string {
    const typeMap: Record<string, string> = {
      'treatment': 'Treatments',
      'clinical_trial': 'Clinical Trials',
      'study': 'Research Studies',
      'guideline': 'Guidelines',
      'news': 'News & Updates',
      'research': 'Research',
      'diagnosis': 'Diagnosis',
      'symptoms': 'Symptoms'
    };

    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  private findMostProductiveWeek(findings: ResearchFinding[]): ResearchMetrics['mostProductivePeriod'] {
    if (findings.length === 0) return null;

    const weekMap = new Map<string, ResearchFinding[]>();

    findings.forEach(f => {
      const date = new Date(f.timestamp || f.createdAt || Date.now());
      const weekStart = startOfWeek(date);
      const weekKey = weekStart.toISOString();

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(f);
    });

    let maxWeek = { start: new Date(), end: new Date(), count: 0 };

    weekMap.forEach((weekFindings, weekKey) => {
      if (weekFindings.length > maxWeek.count) {
        const start = new Date(weekKey);
        const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        maxWeek = { start, end, count: weekFindings.length };
      }
    });

    return maxWeek.count > 0 ? maxWeek : null;
  }

  private formatAgentType(type: string): string {
    const agentTypeMap: Record<string, string> = {
      'treatment_breakthrough': 'Treatment Breakthrough Agent',
      'clinical_trial': 'Clinical Trial Research Agent',
      'medical_literature': 'Medical Literature Agent',
      'pattern_recognition': 'Pattern Recognition Agent',
      'insurance_access': 'Insurance & Access Agent',
      'general': 'General Research Agent'
    };

    return agentTypeMap[type] || type.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Agent';
  }

  private getAgentDisplayName(agentId: string): string {
    // Fallback for older findings without agentType
    // Just return a generic name since the ID is a timestamp-random string
    return 'Research Agent';
  }
}

export const researchInsightsService = new ResearchInsightsService();