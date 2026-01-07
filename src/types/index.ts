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

export interface ResearchFinding {
  id: string;
  agentId: string;
  topicId: string;
  type: 'treatment' | 'trial' | 'study' | 'guideline' | 'news';
  title: string;
  summary: string;
  details: string;
  source: ResearchSource;
  relevanceScore: number; // 0-1
  confidenceLevel: 'high' | 'medium' | 'low';
  isNew: boolean;
  isContradictory?: boolean;
  relatedFindings?: string[]; // IDs of related findings
  extractedEntities?: {
    medications?: string[];
    dosages?: string[];
    sideEffects?: string[];
    institutions?: string[];
  };
  timestamp: number;
  userEngagement?: {
    viewed?: boolean;
    clicked?: boolean;
    dismissed?: boolean;
    shared?: boolean;
    notes?: string;
  };
}

export interface ResearchSource {
  name: string;
  url?: string;
  type: 'journal' | 'fda' | 'clinical_trial' | 'medical_site' | 'community';
  credibilityScore?: number;
  publishDate?: string;
  authors?: string[];
  doi?: string;
  warning?: string; // For community sources
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
  insights?: TopicInsight[];
  connections?: TopicConnection[];
  createdAt: number;
  updatedAt: number;
  lastAgentRun?: number;
  tags?: string[];
  familyAccess?: FamilyAccess[];
}

export interface TopicInsight {
  id: string;
  type: 'trend' | 'pattern' | 'contradiction' | 'breakthrough';
  title: string;
  description: string;
  findingIds: string[]; // Related research findings
  confidence: 'high' | 'medium' | 'low';
  generatedAt: number;
}

export interface TopicConnection {
  relatedTopicId: string;
  connectionType: 'similar_condition' | 'shared_treatment' | 'comorbidity';
  strength: number; // 0-1
  sharedFindings?: string[];
}

// ============= PATIENT CARE & TIMELINE =============

export type TimelineEventType =
  | 'symptom'
  | 'medication_change'
  | 'appointment'
  | 'lab_result'
  | 'milestone'
  | 'hospitalization'
  | 'treatment_start'
  | 'treatment_end';

export interface TimelineEvent {
  id: string;
  date: number;
  type: TimelineEventType;
  title: string;
  description?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  audioRecordingId?: string;
  images?: string[];
  extractedData?: {
    medications?: MedicationInfo[];
    labValues?: LabResult[];
    vitalSigns?: VitalSigns;
    actionItems?: string[];
  };
  linkedTopicId?: string;
  createdAt: number;
  createdBy: string; // User ID
}

export interface MedicationInfo {
  name: string;
  dosage?: string;
  frequency?: string;
  startDate?: number;
  endDate?: number;
  reason?: string;
  sideEffects?: string[];
}

export interface LabResult {
  testName: string;
  value: string | number;
  unit?: string;
  normalRange?: string;
  isAbnormal?: boolean;
  date: number;
}

export interface VitalSigns {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  oxygenSaturation?: number;
}

// ============= AUDIO & TRANSCRIPTION =============

export interface AudioRecording {
  id: string;
  title: string;
  duration: number; // seconds
  fileSize: number; // bytes
  mimeType: string;
  recordedAt: number;
  transcription?: Transcription;
  linkedEventId?: string;
  tags?: string[];
}

export interface Transcription {
  id: string;
  audioId: string;
  text: string;
  summary: TranscriptionSummary;
  extractedEntities?: {
    medications?: string[];
    symptoms?: string[];
    nextSteps?: string[];
    appointments?: AppointmentExtraction[];
    concerns?: string[];
  };
  confidence: number;
  processedAt: number;
}

export interface TranscriptionSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  medicalChanges?: string[];
  followUpNeeded?: boolean;
  sentiment?: 'positive' | 'neutral' | 'concerned';
}

export interface AppointmentExtraction {
  specialty?: string;
  suggestedTimeframe?: string;
  reason?: string;
  urgency?: 'routine' | 'soon' | 'urgent';
}

// ============= FAMILY & COLLABORATION =============

export type FamilyRole = 'owner' | 'caregiver' | 'viewer';

export interface FamilyMember {
  id: string;
  email: string;
  name: string;
  role: FamilyRole;
  permissions: FamilyPermissions;
  addedAt: number;
  lastAccess?: number;
}

export interface FamilyPermissions {
  canEdit: boolean;
  canAddFindings: boolean;
  canRunAgents: boolean;
  canViewSensitive: boolean;
  canExport: boolean;
}

export interface FamilyAccess {
  memberId: string;
  topicId: string;
  role: FamilyRole;
  grantedAt: number;
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

// ============= API & COST TRACKING =============

export interface ApiUsage {
  id: string;
  service: 'anthropic' | 'openai' | 'brave' | 'pubmed';
  endpoint: string;
  timestamp: number;
  tokens?: number;
  cost: number; // in cents
  agentId?: string;
  success: boolean;
  responseTime?: number; // milliseconds
}

export interface MonthlyCostSummary {
  month: string; // "2024-01"
  totalCost: number; // in dollars
  byService: Record<string, number>;
  byAgent: Record<string, number>;
  apiCalls: number;
  withinBudget: boolean;
}

// ============= DATABASE SCHEMA =============

export interface DatabaseSchema {
  topics: Topic;
  agents: Agent;
  findings: ResearchFinding;
  timeline: TimelineEvent;
  audio: AudioRecording;
  notifications: Notification;
  apiUsage: ApiUsage;
  preferences: UserPreferences;
  family: FamilyMember;
}

// ============= SMART DIGEST =============

export type DigestTimeframe = 'daily' | 'weekly' | 'monthly' | 'all-time';
export type DigestThemeCategory = 'treatment' | 'mechanism' | 'trial' | 'outcome' | 'diagnostic' | 'prevention';
export type ExplanationMode = 'detailed' | 'simple';

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
  findingIds: string[]; // Findings to include in digest
  requestedBy: 'user' | 'system' | 'background';
  estimatedCompletionTime?: number;
  progress?: {
    stage: 'queued' | 'fetching' | 'analyzing' | 'generating' | 'validating';
    percentage: number;
    message: string;
  };
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

  // Thematic grouping of related findings
  themes: DigestTheme[];

  // Key insights extracted from all findings
  keyTakeaways: string[];

  // Breakthrough discoveries if any
  breakthroughs?: Breakthrough[];

  // Conflicting or contradictory information
  contradictions?: Contradiction[];

  // Trend analysis
  trends: {
    emerging: TrendItem[];      // New or increasing research
    declining: TrendItem[];      // Decreasing focus
    stable: TrendItem[];         // Consistent areas
  };

  // Statistical overview
  statistics: {
    totalFindings: number;
    newFindings: number;         // Since last digest
    highRelevanceCount: number;
    sourceCount: number;
    avgConfidence: number;        // 0-1
  };

  // Top sources contributing to this digest
  topSources: SourceSummary[];

  // Related finding IDs for drill-down
  allFindingIds: string[];

  // User interaction data
  userEngagement?: {
    viewed: boolean;
    viewedAt?: number;
    expandedThemes?: string[];   // Theme IDs user expanded
    followUpQuestions?: string[]; // Questions user asked
  };
}

export interface DigestTheme {
  id: string;
  title: string;                 // e.g., "Combination Therapy Advances"
  summary: string;                // 2-3 sentence theme summary
  category: DigestThemeCategory;
  importance: 'critical' | 'high' | 'medium' | 'low';
  findingIds: string[];           // Related finding IDs
  findingCount: number;

  // Key entities within this theme
  entities?: {
    medications?: string[];
    institutions?: string[];
    researchers?: string[];
  };

  // Aggregated metrics for this theme
  avgRelevance: number;           // 0-1
  avgConfidence: 'high' | 'medium' | 'low';

  // Visual indicator
  icon?: string;                  // Icon name for UI
  color?: string;                 // Theme color for UI
}

export interface Breakthrough {
  id: string;
  title: string;
  description: string;
  impact: 'paradigm-shift' | 'major' | 'moderate';
  findingIds: string[];
  date: number;
  source: string;
}

export interface Contradiction {
  id: string;
  topic: string;                   // What's contradicted
  findingA: {
    id: string;
    claim: string;
    source: string;
  };
  findingB: {
    id: string;
    claim: string;
    source: string;
  };
  explanation?: string;            // Why this might occur
  requiresAttention: boolean;
}

export interface TrendItem {
  topic: string;
  changePercent?: number;          // % change from previous period
  findingCount: number;
  description?: string;
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
  startedAt: number;
  lastMessageAt: number;
  messages: ChatMessage[];
  context: ChatContext;
  status: 'active' | 'archived';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;

  // Source citations embedded in response
  citations?: SourceCitation[];

  // Suggested follow-up questions
  suggestedQuestions?: string[];

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
  findingId: string;
  text: string;                    // Display text e.g., "[PubMed Study, 2025]"
  position: number;                // Character position in message
}

export interface ChatContext {
  digest?: SmartDigest;             // Current digest being discussed
  allFindings: string[];            // All finding IDs available
  userProfile: {
    knowledgeLevel: 'expert' | 'intermediate' | 'layman';
    interests: string[];
    previousTopics: string[];
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