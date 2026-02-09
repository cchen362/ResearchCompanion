// Core data models for the Medical Research Companion PWA

// ============= AGENT TYPES =============

export type AgentType =
  | 'treatment_breakthrough'
  | 'clinical_trial'
  | 'medical_literature'
  | 'insurance_access'
  | 'pattern_recognition';

export type AgentPriority = 'critical' | 'high' | 'medium' | 'low';
export type AgentStatus = 'idle' | 'running' | 'scheduled' | 'error';

export interface AgentConfig {
  updateFrequency: 'hourly' | 'daily' | 'weekly' | 'adaptive';
  priority: AgentPriority;
  searchDepth: 'quick' | 'standard' | 'deep';
  sources?: string[];
  locationFilter?: {
    country?: string;
    state?: string;
    maxDistanceMiles?: number;
  };
  costLimit?: number; // Max API cost per run in cents
}

export interface AgentRun {
  id: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  status: 'success' | 'partial' | 'failed';
  findingsCount: number;
  apiCost?: number;
  error?: string;
}

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  config: AgentConfig;
  lastRun?: number;
  nextScheduledRun?: number;
  status: AgentStatus;
  topicId: string; // Which topic/disease this agent monitors
  createdAt: number;
  updatedAt: number;
  learningProfile?: AgentLearningProfile;
}

export interface AgentLearningProfile {
  preferredSources: string[];
  engagementScores: Record<string, number>; // source -> score
  userInteractionPatterns: {
    clickRate: number;
    dismissRate: number;
    shareRate: number;
  };
  adaptedFrequency?: string;
}

// ============= RESEARCH & FINDINGS =============

/**
 * Category of research finding for classification and visualization
 */
export type FindingCategory =
  | 'clinical_trial'    // Active or completed clinical trials
  | 'treatment'         // Treatment options and therapies
  | 'mechanism'         // Disease mechanisms and pathophysiology
  | 'outcome'          // Patient outcomes and prognosis
  | 'diagnostic'       // Diagnostic methods and biomarkers
  | 'prevention'       // Prevention strategies
  | 'epidemiology';    // Disease prevalence and patterns

/**
 * Priority level for findings:
 * - critical: Immediately actionable, safety-critical information
 * - high: Important for treatment decisions
 * - medium: Useful context and background
 * - low: Supplementary information
 */
export type FindingPriority = 'critical' | 'high' | 'medium' | 'low';

// Aliases for backward compatibility and convenience
export type Finding = ResearchFinding;
export type ResearchAgent = Agent;
export type DigestData = SmartDigest;
export type ResearchTopic = Topic;

export interface ResearchFinding {
  id: string;
  agentId: string;
  agentType?: AgentType;  // Type of agent that found this
  topicId: string;
  type: 'treatment' | 'trial' | 'study' | 'guideline' | 'news';

  // Core content fields
  title: string;
  summary: string;
  details: string;
  content?: string;  // Full content (alias for details for backward compat)

  // Source information
  source: ResearchSource;

  // Categorization and tagging
  category?: FindingCategory;  // Category for classification
  tags?: string[];  // Descriptive tags for filtering and grouping
  priority?: FindingPriority;  // Priority level for display

  // Status flags
  isNew: boolean;  // New within last 7 days
  isContradictory?: boolean;
  relatedFindings?: string[]; // IDs of related findings
  extractedEntities?: {
    medications?: string[];
    dosages?: string[];
    sideEffects?: string[];
    institutions?: string[];
  };
  timestamp: number;
  foundDate?: string;  // ISO date when finding was discovered
  publishedAt?: string; // Original publication date
  userEngagement?: {
    viewed?: boolean;
    clicked?: boolean;
    dismissed?: boolean;
    shared?: boolean;
    notes?: string;
  };
  // Additional clinical details
  snippet?: string;
  keyInsights?: string[];
  clinicalRelevance?: string;
  clinicalImplications?: string[];
  limitations?: string[];
  keywords?: string[];
  metadata?: {
    sampleSize?: number;
    duration?: string;
    studyType?: string;
    evidenceLevel?: string;
    digestReferences?: string[];  // Digest IDs that reference this finding
    [key: string]: any;
  };
}

export interface ResearchSource {
  name: string;
  title?: string;  // Title of the source (alias for name for backward compat)
  url?: string;
  type: 'journal' | 'fda' | 'clinical_trial' | 'medical_site' | 'community' | 'pubmed' | 'guidelines' | 'research_paper' | 'web';

  // Source characteristics (factual information only)
  credibility?: 'peer-reviewed' | 'preprint' | 'news' | 'blog' | 'unknown';
  impactFactor?: number; // Journal impact factor (factual metric)
  citationCount?: number; // Number of citations (factual metric)

  // Metadata
  publishDate?: string;
  authors?: string[];
  doi?: string;
  journal?: string;

  // Display helpers
  displayName?: string; // Fallback when name is "Unknown Source"
  sourceIcon?: string; // Icon identifier for UI
  warning?: string; // For community sources or low-quality sources
}

// ============= MEDICAL TOPIC/DISEASE =============

export interface DiseaseProfile {
  name: string;
  icdCode?: string;
  rareDisease: boolean;
  progressionRate: 'rapid' | 'moderate' | 'slow' | 'variable';
  category: string[]; // e.g., ['genetic', 'metabolic']
  relatedConditions?: string[];
  commonMutations?: string[];
}

export interface PatientContext {
  age?: number;
  ageGroup: 'pediatric' | 'adolescent' | 'adult' | 'elderly';
  diagnosisDate?: number;
  currentStage?: 'newly_diagnosed' | 'active_treatment' | 'maintenance' | 'monitoring';
  currentMedications?: string[];
  previousTreatments?: string[];
  knownMutations?: string[];
  location?: {
    country: string;
    state?: string;
    city?: string;
  };
}

export interface Topic {
  id: string;
  name: string;
  diseaseProfile: DiseaseProfile;
  patientContext?: PatientContext;
  agents: Agent[];
  researchHistory: ResearchFinding[];
  createdAt: number;
  updatedAt: number;
  lastAgentRun?: number;
  tags?: string[];
}

// ============= NOTIFICATIONS & ALERTS =============

export type NotificationType =
  | 'breakthrough_treatment'
  | 'new_trial'
  | 'contradiction_found'
  | 'agent_complete'
  | 'appointment_reminder'
  | 'medication_reminder';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  data?: any; // Type-specific payload
  createdAt: number;
  readAt?: number;
  dismissedAt?: number;
  actionUrl?: string;
}

// ============= SETTINGS & PREFERENCES =============

export interface UserPreferences {
  notificationSettings: {
    enablePush: boolean;
    enableEmail: boolean;
    enableInApp: boolean;
    quietHours?: {
      start: string; // "22:00"
      end: string; // "08:00"
    };
  };
  agentSettings: {
    autoRun: boolean;
    costLimit: number; // Monthly limit in dollars
    preferredSources?: string[];
    languagePreferences?: string[];
  };
  displaySettings: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
    showTechnicalDetails: boolean;
  };
  privacySettings: {
    allowAnalytics: boolean;
    shareAnonymousData: boolean;
    encryptionEnabled: boolean;
  };
}

// ============= SMART DIGEST =============

export type DigestTimeframe = 'daily' | 'weekly' | 'monthly' | 'all-time';
export type ExplanationMode = 'technical' | 'explained';

// Dual-mode text: both a technical and explained version of the same content
export interface DualModeText {
  technical: string;
  explained: string;
}

// Digest Queue Status Types
export type DigestQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type DigestPriority = 'high' | 'normal' | 'low';

export interface DigestQueueItem {
  id: string;
  topicId: string;
  timeframe: DigestTimeframe;
  status: DigestQueueStatus;
  priority: DigestPriority;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
  error?: string;
  resultDigestId?: string; // ID of generated digest when completed
  digest?: SmartDigest; // The actual digest object (with cache metadata if deduplicated)
  findingIds: string[]; // Findings to include in digest
  requestedBy: 'user' | 'system' | 'background';
  estimatedCompletionTime?: number;
  progress?: {
    stage: 'queued' | 'fetching' | 'analyzing' | 'generating' | 'validating';
    percentage: number;
    message: string;
  };
}

// Source type for categorizing findings
export type DigestSourceType = 'pubmed' | 'clinical_trial' | 'fda' | 'web';

// Featured Discovery - the "hero" content of the digest
export interface FeaturedDiscovery {
  findingId: string;
  sourceType: DigestSourceType;
  technical: {
    quote: string;
    whyItMatters: string;
    actionItem?: string;
  };
  explained: {
    quote: string;
    whyItMatters: string;
    actionItem?: string;
  };
  sourceMetadata: {
    name: string;
    url?: string;
    date?: string;
    studyType?: string;
  };
}

// Top Finding - secondary notable findings
export interface TopFinding {
  findingId: string;
  sourceType: DigestSourceType;
  technical: {
    title: string;
    summary: string;
  };
  explained: {
    title: string;
    summary: string;
  };
  metadata: string;
}

// Source Breakdown - counts by type
export interface SourceBreakdown {
  pubmed: number;
  clinicalTrials: number;
  fda: number;
  web: number;
}

export interface WorthRevisiting {
  oldFindingId: string;
  oldFindingTitle: string;
  oldFindingSummary: DualModeText | string;
  newBreakthroughId: string;
  newBreakthroughTitle: string;
  newBreakthroughSummary: DualModeText | string;
  connectionExplanation: DualModeText | string;
  connectionBasis: string;
}

export interface SmartDigest {
  id: string;
  topicId: string;
  generatedAt: number;
  timeframe: DigestTimeframe;

  // Executive Summary - The most important takeaway in 2-3 sentences
  executiveSummary: string;

  // Simplified version for non-medical users
  laymanSummary?: string;

  // Key insights extracted from all findings (dual-mode: technical + explained)
  keyTakeaways: DualModeText[];

  // Breakthrough discoveries if any
  breakthroughs?: Breakthrough[];

  // Conflicting or contradictory information
  contradictions?: Contradiction[];

  // Statistical overview
  statistics: {
    totalFindings: number;
    newFindings: number;
  };

  // Legacy - no longer computed, kept for backward compat
  topSources?: SourceSummary[];

  // Related finding IDs for drill-down
  allFindingIds: string[];

  // User interaction data
  userEngagement?: {
    viewed: boolean;
    viewedAt?: number;
    expandedThemes?: string[];   // Theme IDs user expanded
    followUpQuestions?: string[]; // Questions user asked
  };

  // Optional clinical sections (may be empty arrays)
  questionsForDoctor?: DualModeText[];
  warningSigns?: DualModeText[];
  clinicalImplications?: string[];

  // Cache metadata for tracking digest source and freshness
  cacheMetadata?: {
    source?: 'postgresql' | 'indexeddb' | 'generated'; // Where this digest came from
    isCached?: boolean;                                 // Whether this is from cache or freshly generated
    deduplicated?: boolean;                             // Whether backend returned existing digest instead of generating new
    originalGeneratedAt?: number;                       // Original generation timestamp if from cache
    cacheRetrievedAt?: number;                          // When retrieved from cache
    cacheExpiresAt?: number;                            // When cache entry expires
  };

  // NEW fields for magazine editorial design
  featuredDiscovery?: FeaturedDiscovery;
  topFindings?: TopFinding[];
  sourceBreakdown?: SourceBreakdown;

  // Companion Intelligence fields (Plan 015c)
  researchPulse?: string;
  worthRevisiting?: WorthRevisiting[];
}

export interface Breakthrough {
  id: string;
  title: DualModeText;
  description: DualModeText;
  impact: 'paradigm-shift' | 'major' | 'moderate';
  findingIds: string[];
  date: number;
  source: string;
}

export interface Contradiction {
  id: string;
  topic: DualModeText;
  findingA: {
    id: string;
    claim: DualModeText;
    source: string;
  };
  findingB: {
    id: string;
    claim: DualModeText;
    source: string;
  };
  explanation?: DualModeText;
  requiresAttention: boolean;
}

export interface SourceSummary {
  name: string;
  type: 'journal' | 'fda' | 'clinical_trial' | 'medical_site' | 'community';
  findingCount: number;
  avgCredibility: number;
  topContributions: string[];      // Brief descriptions
}

// ============= CONVERSATIONAL INTERFACE =============

export interface FindingsChat {
  id: string;
  topicId: string;
  title: string;                    // Chat title
  startedAt?: number;               // Optional for backward compatibility
  createdAt: string;                // ISO date string
  lastMessageAt: string;            // ISO date string
  messages?: ChatMessage[];         // Optional - stored separately
  messageCount: number;             // Count of messages
  context: ChatContext;
  status: 'active' | 'archived';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;  // ISO date string

  // Source citations embedded in response
  citations?: SourceCitation[];

  // Suggested follow-up questions
  suggestedQuestions?: string[];

  // Message metadata
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
    error?: string;
    topicId?: string;
    timestamp?: string;
  };

  // Findings referenced in this message
  referencedFindingIds?: string[];

  // User feedback on response
  feedback?: {
    helpful: boolean;
    rating?: number;              // 1-5
    comment?: string;
  };
}

export interface SourceCitation {
  findingId: string | null;         // Can be null for placeholder citations
  text?: string;                    // Display text e.g., "[PubMed Study, 2025]"
  position?: number;                // Character position in message
  highlightStart?: number;          // Start position for highlighting
  highlightEnd?: number;            // End position for highlighting
  citationText?: string;            // Text to display in citation
  citationNumber?: number;          // Citation number [1], [2], etc.
  isPlaceholder?: boolean;          // True if citation references non-existent finding
  source?: ResearchSource;          // Source information from the finding
}

export interface ChatContext {
  digest?: SmartDigest;             // Current digest being discussed
  allFindings?: string[];           // All finding IDs available (optional)
  currentFindings?: string[];        // Currently selected findings
  expandedTopics?: string[];         // Expanded topic sections
  recentInteractions?: string[];     // Recent user interactions
  userPreferences?: Record<string, any>;  // User preference overrides
  userProfile?: {
    knowledgeLevel: 'expert' | 'intermediate' | 'layman';
    interests: string[];
    previousTopics?: string[];
    focusArea?: string;
  };
  conversationFocus?: string;       // Current topic focus
}

// ============= SEARCH & QUERY =============

export interface SearchQuery {
  query: string;
  intent?: {
    topic?: string;
    focus?: 'treatments' | 'symptoms' | 'trials' | 'overview' | 'diagnosis';
    modifiers?: string[];
  };
  needsClarification?: boolean;
  suggestions?: string[];
}

export interface SearchResult {
  id: string;
  query: SearchQuery;
  findings: ResearchFinding[];
  summary: {
    overview: string;
    newResearch?: string;
    treatmentUpdates?: string;
    considerations?: string;
    laymanSummary: string;
  };
  sources: ResearchSource[];
  timestamp: number;
}