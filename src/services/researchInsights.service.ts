import type { ResearchFinding, SmartDigest, Topic } from '@/types';
import { differenceInDays, format, startOfMonth } from 'date-fns';

/**
 * Research Insights Service - Transformed from Analytics
 * Analyzes research findings patterns and provides factual metrics
 * Aligns with "Facts, Not Scores™" principle
 */

export interface ResearchMetrics {
  // Factual counts only - no arbitrary scores
  totalFindings: number;
  uniqueSources: number;
  criticalFindings: number;
  highPriorityFindings: number;

  // Source analysis (factual)
  sourceDistribution: {
    source: string;
    count: number;
    type: 'journal' | 'clinical_trial' | 'fda' | 'web' | 'other';
    mostRecent: Date;
  }[];

  // Category breakdown (factual)
  findingsByCategory: {
    category: string;
    count: number;
    percentage: number; // of total
  }[];

  // Priority distribution (factual)
  findingsByPriority: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    count: number;
    percentage: number;
  }[];

  // Temporal patterns (factual)
  researchVelocity: {
    date: string; // month
    count: number;
    categories: string[];
  }[];

  // Knowledge gaps from digests (factual)
  knowledgeGaps: string[];

  // Research coverage (factual)
  topicsExplored: string[];
  avgFindingsPerTopic: number;
}

export interface SourceCredibility {
  sourceName: string;
  totalFindings: number;
  journalType?: 'peer-reviewed' | 'preprint' | 'news' | 'other';
  averageStudySize?: number; // from metadata
  publicationYears: number[]; // years of publications
  studyTypes: string[]; // RCT, observational, etc.
}

export interface ResearchPattern {
  type: 'emerging_topic' | 'research_gap' | 'convergent_evidence' | 'conflicting_results';
  description: string;
  findingCount: number;
  sources: string[];
  firstSeen: Date;
  lastSeen: Date;
}

export interface ResearchProgress {
  startDate: Date;
  totalDays: number;
  findingsPerWeek: number;
  mostProductivePeriod: {
    start: Date;
    end: Date;
    findingsCount: number;
  };
  researchPhases: {
    phase: 'exploration' | 'deep_dive' | 'synthesis';
    startDate: Date;
    endDate?: Date;
    findingsCount: number;
    dominantCategories: string[];
  }[];
}

class ResearchInsightsService {
  /**
   * Calculate comprehensive research metrics from findings
   * All metrics are factual counts and distributions
   */
  calculateResearchMetrics(
    findings: ResearchFinding[],
    digests: SmartDigest[]
  ): ResearchMetrics {
    // Basic counts
    const totalFindings = findings.length;
    const criticalFindings = findings.filter(f => f.priority === 'critical').length;
    const highPriorityFindings = findings.filter(f => f.priority === 'high').length;

    // Source analysis
    const sourceMap = new Map<string, {
      count: number;
      type: string;
      dates: Date[];
    }>();

    findings.forEach(finding => {
      const sourceName = finding.source?.name || 'Unknown Source';
      const sourceType = this.determineSourceType(finding.source);

      if (!sourceMap.has(sourceName)) {
        sourceMap.set(sourceName, {
          count: 0,
          type: sourceType,
          dates: []
        });
      }

      const source = sourceMap.get(sourceName)!;
      source.count++;
      source.dates.push(new Date(finding.createdAt || Date.now()));
    });

    const sourceDistribution = Array.from(sourceMap.entries()).map(([name, data]) => ({
      source: name,
      count: data.count,
      type: data.type as any,
      mostRecent: new Date(Math.max(...data.dates.map(d => d.getTime())))
    })).sort((a, b) => b.count - a.count);

    // Category breakdown
    const categoryMap = new Map<string, number>();
    findings.forEach(f => {
      const category = f.category || 'uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const findingsByCategory = Array.from(categoryMap.entries()).map(([cat, count]) => ({
      category: cat,
      count,
      percentage: Math.round((count / totalFindings) * 100)
    })).sort((a, b) => b.count - a.count);

    // Priority distribution
    const priorityMap = new Map<string, number>();
    findings.forEach(f => {
      const priority = f.priority || 'medium';
      priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1);
    });

    const findingsByPriority = ['critical', 'high', 'medium', 'low'].map(priority => ({
      priority: priority as any,
      count: priorityMap.get(priority) || 0,
      percentage: Math.round(((priorityMap.get(priority) || 0) / totalFindings) * 100)
    }));

    // Research velocity (findings per month)
    const velocityMap = new Map<string, {
      count: number;
      categories: Set<string>;
    }>();

    findings.forEach(f => {
      const date = new Date(f.createdAt || Date.now());
      const monthKey = format(startOfMonth(date), 'yyyy-MM');

      if (!velocityMap.has(monthKey)) {
        velocityMap.set(monthKey, {
          count: 0,
          categories: new Set()
        });
      }

      const month = velocityMap.get(monthKey)!;
      month.count++;
      if (f.category) {
        month.categories.add(f.category);
      }
    });

    const researchVelocity = Array.from(velocityMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        categories: Array.from(data.categories)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Knowledge gaps from digests
    const knowledgeGaps = digests
      .flatMap(d => d.knowledgeGaps || [])
      .filter((gap, index, self) => self.indexOf(gap) === index); // unique

    // Topics explored
    const topicsExplored = Array.from(new Set(findings.map(f => f.category).filter(Boolean)));

    return {
      totalFindings,
      uniqueSources: sourceDistribution.length,
      criticalFindings,
      highPriorityFindings,
      sourceDistribution: sourceDistribution.slice(0, 10), // top 10
      findingsByCategory,
      findingsByPriority,
      researchVelocity,
      knowledgeGaps,
      topicsExplored,
      avgFindingsPerTopic: topicsExplored.length > 0
        ? Math.round(totalFindings / topicsExplored.length)
        : 0
    };
  }

  /**
   * Analyze source credibility based on type and metadata
   */
  analyzeSourceCredibility(findings: ResearchFinding[]): SourceCredibility[] {
    const sourceAnalysis = new Map<string, SourceCredibility>();

    findings.forEach(finding => {
      const sourceName = finding.source?.name || 'Unknown';

      if (!sourceAnalysis.has(sourceName)) {
        sourceAnalysis.set(sourceName, {
          sourceName,
          totalFindings: 0,
          journalType: this.categorizeJournalType(finding.source),
          averageStudySize: 0,
          publicationYears: [],
          studyTypes: []
        });
      }

      const analysis = sourceAnalysis.get(sourceName)!;
      analysis.totalFindings++;

      // Extract publication year if available
      if (finding.source?.publishedAt) {
        const year = new Date(finding.source.publishedAt).getFullYear();
        if (!analysis.publicationYears.includes(year)) {
          analysis.publicationYears.push(year);
        }
      }

      // Extract study type from metadata
      if (finding.metadata?.studyType && !analysis.studyTypes.includes(finding.metadata.studyType)) {
        analysis.studyTypes.push(finding.metadata.studyType);
      }

      // Calculate average study size
      if (finding.metadata?.sampleSize) {
        const currentTotal = (analysis.averageStudySize || 0) * (analysis.totalFindings - 1);
        analysis.averageStudySize = Math.round(
          (currentTotal + (finding.metadata.sampleSize as number)) / analysis.totalFindings
        );
      }
    });

    return Array.from(sourceAnalysis.values())
      .sort((a, b) => b.totalFindings - a.totalFindings);
  }

  /**
   * Identify research patterns without scores
   */
  identifyResearchPatterns(
    findings: ResearchFinding[],
    digests: SmartDigest[]
  ): ResearchPattern[] {
    const patterns: ResearchPattern[] = [];

    // Group findings by category to find emerging topics
    const categoryTimeline = new Map<string, Date[]>();
    findings.forEach(f => {
      if (f.category) {
        if (!categoryTimeline.has(f.category)) {
          categoryTimeline.set(f.category, []);
        }
        categoryTimeline.get(f.category)!.push(new Date(f.createdAt || Date.now()));
      }
    });

    // Identify emerging topics (categories with recent growth)
    categoryTimeline.forEach((dates, category) => {
      if (dates.length >= 5) {
        const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
        const recentDates = sortedDates.slice(-5);
        const timespanDays = differenceInDays(
          recentDates[recentDates.length - 1],
          recentDates[0]
        );

        if (timespanDays <= 7) { // 5+ findings in 7 days = emerging
          patterns.push({
            type: 'emerging_topic',
            description: `Rapid research growth in ${category}`,
            findingCount: dates.length,
            sources: this.getSourcesForCategory(findings, category),
            firstSeen: sortedDates[0],
            lastSeen: sortedDates[sortedDates.length - 1]
          });
        }
      }
    });

    // Identify research gaps from digests
    const gaps = digests.flatMap(d => d.knowledgeGaps || []);
    if (gaps.length > 0) {
      patterns.push({
        type: 'research_gap',
        description: `${gaps.length} knowledge gaps identified`,
        findingCount: 0, // gaps have no findings yet
        sources: [],
        firstSeen: new Date(),
        lastSeen: new Date()
      });
    }

    // Identify conflicting results from digest contradictions
    const contradictions = digests.flatMap(d => d.contradictions || []);
    if (contradictions.length > 0) {
      patterns.push({
        type: 'conflicting_results',
        description: `${contradictions.length} contradictions found across studies`,
        findingCount: contradictions.reduce((sum, c) => sum + c.findingIds.length, 0),
        sources: this.getUniqueSourcesFromContradictions(findings, contradictions),
        firstSeen: new Date(Math.min(...findings.map(f => new Date(f.createdAt || Date.now()).getTime()))),
        lastSeen: new Date()
      });
    }

    return patterns;
  }

  /**
   * Track research progress over time
   */
  trackResearchProgress(findings: ResearchFinding[]): ResearchProgress {
    if (findings.length === 0) {
      return {
        startDate: new Date(),
        totalDays: 0,
        findingsPerWeek: 0,
        mostProductivePeriod: {
          start: new Date(),
          end: new Date(),
          findingsCount: 0
        },
        researchPhases: []
      };
    }

    const sortedFindings = [...findings].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    const startDate = new Date(sortedFindings[0].createdAt || Date.now());
    const endDate = new Date(sortedFindings[sortedFindings.length - 1].createdAt || Date.now());
    const totalDays = differenceInDays(endDate, startDate) + 1;

    // Calculate findings per week
    const weeks = Math.ceil(totalDays / 7) || 1;
    const findingsPerWeek = Math.round(findings.length / weeks);

    // Find most productive week
    const weeklyFindings = new Map<string, ResearchFinding[]>();
    sortedFindings.forEach(f => {
      const weekStart = this.getWeekStart(new Date(f.createdAt || Date.now()));
      const weekKey = weekStart.toISOString();
      if (!weeklyFindings.has(weekKey)) {
        weeklyFindings.set(weekKey, []);
      }
      weeklyFindings.get(weekKey)!.push(f);
    });

    let mostProductiveWeek = {
      start: startDate,
      end: startDate,
      findingsCount: 0
    };

    weeklyFindings.forEach((weekFindings, weekKey) => {
      if (weekFindings.length > mostProductiveWeek.findingsCount) {
        const weekStart = new Date(weekKey);
        mostProductiveWeek = {
          start: weekStart,
          end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
          findingsCount: weekFindings.length
        };
      }
    });

    // Identify research phases based on category focus
    const phases = this.identifyResearchPhases(sortedFindings);

    return {
      startDate,
      totalDays,
      findingsPerWeek,
      mostProductivePeriod: mostProductiveWeek,
      researchPhases: phases
    };
  }

  // Helper methods
  private determineSourceType(source: any): string {
    if (!source) return 'other';
    const name = source.name?.toLowerCase() || '';
    const type = source.type?.toLowerCase() || '';

    if (name.includes('pubmed') || type.includes('pubmed')) return 'journal';
    if (name.includes('clinical') || type.includes('trial')) return 'clinical_trial';
    if (name.includes('fda') || type.includes('fda')) return 'fda';
    if (name.includes('web') || type.includes('web')) return 'web';
    return 'other';
  }

  private categorizeJournalType(source: any): 'peer-reviewed' | 'preprint' | 'news' | 'other' {
    if (!source) return 'other';
    const name = source.name?.toLowerCase() || '';

    if (name.includes('pubmed') || name.includes('journal')) return 'peer-reviewed';
    if (name.includes('arxiv') || name.includes('medrxiv')) return 'preprint';
    if (name.includes('news') || name.includes('web')) return 'news';
    return 'other';
  }

  private getSourcesForCategory(findings: ResearchFinding[], category: string): string[] {
    return Array.from(new Set(
      findings
        .filter(f => f.category === category)
        .map(f => f.source?.name || 'Unknown')
    ));
  }

  private getUniqueSourcesFromContradictions(findings: ResearchFinding[], contradictions: any[]): string[] {
    const sources = new Set<string>();
    contradictions.forEach(c => {
      c.findingIds.forEach((id: string) => {
        const finding = findings.find(f => f.id === id);
        if (finding?.source?.name) {
          sources.add(finding.source.name);
        }
      });
    });
    return Array.from(sources);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  private identifyResearchPhases(sortedFindings: ResearchFinding[]): any[] {
    // Simple phase identification based on finding density and categories
    const phases: any[] = [];
    const chunkSize = Math.ceil(sortedFindings.length / 3); // divide into 3 phases

    for (let i = 0; i < sortedFindings.length; i += chunkSize) {
      const chunk = sortedFindings.slice(i, Math.min(i + chunkSize, sortedFindings.length));
      const categories = new Map<string, number>();

      chunk.forEach(f => {
        if (f.category) {
          categories.set(f.category, (categories.get(f.category) || 0) + 1);
        }
      });

      const dominantCategories = Array.from(categories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      const phaseType = i === 0 ? 'exploration' :
                       i < sortedFindings.length - chunkSize ? 'deep_dive' :
                       'synthesis';

      phases.push({
        phase: phaseType,
        startDate: new Date(chunk[0].createdAt || Date.now()),
        endDate: chunk.length > 0 ? new Date(chunk[chunk.length - 1].createdAt || Date.now()) : undefined,
        findingsCount: chunk.length,
        dominantCategories
      });
    }

    return phases;
  }
}

export const researchInsightsService = new ResearchInsightsService();