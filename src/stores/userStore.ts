import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { UserPreferences, FamilyMember } from '../types';
import { getDB } from '../utils/db/database';
import { logger } from '../utils/logger';

interface NotificationSettings {
  enabled: boolean;
  agentCompleted: boolean;
  digestReady: boolean;
  findingsThreshold: number;
  dailySummary: boolean;
  weeklyReport: boolean;
  soundEnabled: boolean;
  emailEnabled: boolean;
}

interface PrivacySettings {
  shareAnonymousUsage: boolean;
  allowCrashReports: boolean;
  dataRetentionDays: number;
  autoDeleteOldData: boolean;
  encryptLocalData: boolean;
  requireAuth: boolean;
}

interface ResearchPreferences {
  preferredSources: string[];
  excludedSources: string[];
  minRelevanceScore: number;
  autoRunAgents: boolean;
  agentFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  maxAgentBudget: number;
  priorityTopics: string[];
  languagePreferences: string[];
  includePreprints: boolean;
  includeClinicalTrials: boolean;
}

interface ExportPreferences {
  defaultFormat: 'pdf' | 'csv' | 'json' | 'fhir';
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includeSources: boolean;
  compressExports: boolean;
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupLocation: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'caregiver' | 'researcher' | 'healthcare_provider';
  avatar?: string;
  bio?: string;
  createdAt: string;
  lastActive: string;
}

interface UserStore {
  // User Profile
  profile: UserProfile | null;
  isAuthenticated: boolean;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearProfile: () => void;

  // Preferences
  preferences: UserPreferences | null;
  loadPreferences: () => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;

  // Notification Settings
  notifications: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  toggleNotifications: () => void;

  // Privacy Settings
  privacy: PrivacySettings;
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;

  // Research Preferences
  research: ResearchPreferences;
  updateResearchPreferences: (prefs: Partial<ResearchPreferences>) => void;
  addPreferredSource: (source: string) => void;
  removePreferredSource: (source: string) => void;
  addExcludedSource: (source: string) => void;
  removeExcludedSource: (source: string) => void;

  // Export Preferences
  exportPrefs: ExportPreferences;
  updateExportPreferences: (prefs: Partial<ExportPreferences>) => void;

  // Family Members
  familyMembers: FamilyMember[];
  loadFamilyMembers: () => Promise<void>;
  addFamilyMember: (member: Omit<FamilyMember, 'id'>) => Promise<void>;
  updateFamilyMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
  removeFamilyMember: (id: string) => Promise<void>;

  // API Usage
  apiUsage: {
    totalCost: number;
    monthlyLimit: number;
    currentMonth: string;
    breakdown: Map<string, number>;
  };
  loadApiUsage: () => Promise<void>;
  updateApiUsage: (service: string, cost: number) => Promise<void>;
  setMonthlyLimit: (limit: number) => void;
  resetMonthlyUsage: () => Promise<void>;

  // Feature Flags
  featureFlags: Map<string, boolean>;
  setFeatureFlag: (flag: string, enabled: boolean) => void;
  isFeatureEnabled: (flag: string) => boolean;

  // Session Management
  sessionStartTime: number;
  lastSyncTime: number | null;
  startSession: () => void;
  endSession: () => void;
  updateLastSync: () => void;
}

const defaultProfile: UserProfile = {
  id: 'default_user',
  name: 'User',
  email: '',
  role: 'patient',
  createdAt: new Date().toISOString(),
  lastActive: new Date().toISOString()
};

const defaultNotifications: NotificationSettings = {
  enabled: true,
  agentCompleted: true,
  digestReady: true,
  findingsThreshold: 3,
  dailySummary: false,
  weeklyReport: false,
  soundEnabled: false,
  emailEnabled: false
};

const defaultPrivacy: PrivacySettings = {
  shareAnonymousUsage: false,
  allowCrashReports: true,
  dataRetentionDays: 365,
  autoDeleteOldData: false,
  encryptLocalData: false,
  requireAuth: false
};

const defaultResearch: ResearchPreferences = {
  preferredSources: ['PubMed', 'Clinical Trials', 'Medical News'],
  excludedSources: [],
  minRelevanceScore: 0.7,
  autoRunAgents: true,
  agentFrequency: 'daily',
  maxAgentBudget: 10.00,
  priorityTopics: [],
  languagePreferences: ['en'],
  includePreprints: true,
  includeClinicalTrials: true
};

const defaultExport: ExportPreferences = {
  defaultFormat: 'pdf',
  includeMetadata: true,
  includeTimestamps: true,
  includeSources: true,
  compressExports: false,
  autoBackup: false,
  backupFrequency: 'weekly',
  backupLocation: 'downloads'
};

export const useUserStore = create<UserStore>()(
  devtools(
    persist(
      (set, get) => ({
        // User Profile
        profile: null,
        isAuthenticated: false,
        setProfile: (profile) => set({ profile, isAuthenticated: true }),
        updateProfile: async (updates) => {
          const current = get().profile;
          if (!current) return;

          const updated = { ...current, ...updates, lastActive: new Date().toISOString() };
          set({ profile: updated });

          // Save to IndexedDB
          try {
            const db = await getDB();
            const tx = db.transaction('preferences', 'readwrite');
            const prefs = await tx.objectStore('preferences').get('userProfile');
            await tx.objectStore('preferences').put({ ...prefs, ...updated }, 'userProfile');
            await tx.done;
          } catch (error) {
            logger.error('[UserStore] Failed to update profile:', error);
          }
        },
        clearProfile: () => set({ profile: null, isAuthenticated: false }),

        // Preferences
        preferences: null,
        loadPreferences: async () => {
          try {
            const db = await getDB();
            const prefs = await db.get('preferences', 'user');
            set({ preferences: prefs || null });
          } catch (error) {
            logger.error('[UserStore] Failed to load preferences:', error);
          }
        },
        updatePreferences: async (updates) => {
          const current = get().preferences || {} as UserPreferences;
          const updated = { ...current, ...updates };
          set({ preferences: updated });

          try {
            const db = await getDB();
            await db.put('preferences', { ...updated, id: 'user' }, 'user');
          } catch (error) {
            logger.error('[UserStore] Failed to save preferences:', error);
          }
        },
        resetPreferences: async () => {
          set({ preferences: null });
          try {
            const db = await getDB();
            await db.delete('preferences', 'user');
          } catch (error) {
            logger.error('[UserStore] Failed to reset preferences:', error);
          }
        },

        // Notification Settings
        notifications: defaultNotifications,
        updateNotificationSettings: (settings) => {
          const current = get().notifications;
          set({ notifications: { ...current, ...settings } });
        },
        toggleNotifications: () => {
          const current = get().notifications;
          set({ notifications: { ...current, enabled: !current.enabled } });
        },

        // Privacy Settings
        privacy: defaultPrivacy,
        updatePrivacySettings: (settings) => {
          const current = get().privacy;
          set({ privacy: { ...current, ...settings } });
        },

        // Research Preferences
        research: defaultResearch,
        updateResearchPreferences: (prefs) => {
          const current = get().research;
          set({ research: { ...current, ...prefs } });
        },
        addPreferredSource: (source) => {
          const { research } = get();
          if (!research.preferredSources.includes(source)) {
            set({
              research: {
                ...research,
                preferredSources: [...research.preferredSources, source]
              }
            });
          }
        },
        removePreferredSource: (source) => {
          const { research } = get();
          set({
            research: {
              ...research,
              preferredSources: research.preferredSources.filter(s => s !== source)
            }
          });
        },
        addExcludedSource: (source) => {
          const { research } = get();
          if (!research.excludedSources.includes(source)) {
            set({
              research: {
                ...research,
                excludedSources: [...research.excludedSources, source]
              }
            });
          }
        },
        removeExcludedSource: (source) => {
          const { research } = get();
          set({
            research: {
              ...research,
              excludedSources: research.excludedSources.filter(s => s !== source)
            }
          });
        },

        // Export Preferences
        exportPrefs: defaultExport,
        updateExportPreferences: (prefs) => {
          const current = get().exportPrefs;
          set({ exportPrefs: { ...current, ...prefs } });
        },

        // Family Members
        familyMembers: [],
        loadFamilyMembers: async () => {
          try {
            const db = await getDB();
            const members = await db.getAll('family');
            set({ familyMembers: members });
          } catch (error) {
            logger.error('[UserStore] Failed to load family members:', error);
          }
        },
        addFamilyMember: async (member) => {
          try {
            const db = await getDB();
            const id = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newMember: FamilyMember = { ...member, id };

            await db.add('family', newMember);
            const members = get().familyMembers;
            set({ familyMembers: [...members, newMember] });
          } catch (error) {
            logger.error('[UserStore] Failed to add family member:', error);
            throw error;
          }
        },
        updateFamilyMember: async (id, updates) => {
          try {
            const db = await getDB();
            const existing = await db.get('family', id);
            if (!existing) throw new Error('Family member not found');

            const updated = { ...existing, ...updates };
            await db.put('family', updated);

            const members = get().familyMembers;
            set({
              familyMembers: members.map(m => m.id === id ? updated : m)
            });
          } catch (error) {
            logger.error('[UserStore] Failed to update family member:', error);
            throw error;
          }
        },
        removeFamilyMember: async (id) => {
          try {
            const db = await getDB();
            await db.delete('family', id);

            const members = get().familyMembers;
            set({
              familyMembers: members.filter(m => m.id !== id)
            });
          } catch (error) {
            logger.error('[UserStore] Failed to remove family member:', error);
            throw error;
          }
        },

        // API Usage
        apiUsage: {
          totalCost: 0,
          monthlyLimit: 10.00,
          currentMonth: new Date().toISOString().substring(0, 7),
          breakdown: new Map()
        },
        loadApiUsage: async () => {
          try {
            const db = await getDB();
            const currentMonth = new Date().toISOString().substring(0, 7);
            const usageRecords = await db.getAllFromIndex('apiUsage', 'by-date',
              IDBKeyRange.bound(
                `${currentMonth}-01`,
                `${currentMonth}-31`
              )
            );

            const breakdown = new Map<string, number>();
            let totalCost = 0;

            usageRecords.forEach(record => {
              const current = breakdown.get(record.service) || 0;
              breakdown.set(record.service, current + record.cost);
              totalCost += record.cost;
            });

            set({
              apiUsage: {
                ...get().apiUsage,
                totalCost,
                currentMonth,
                breakdown
              }
            });
          } catch (error) {
            logger.error('[UserStore] Failed to load API usage:', error);
          }
        },
        updateApiUsage: async (service, cost) => {
          try {
            const db = await getDB();
            const now = new Date();
            const usage = {
              id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              service,
              cost,
              date: now.toISOString(),
              month: now.toISOString().substring(0, 7)
            };

            await db.add('apiUsage', usage);

            const { apiUsage } = get();
            const breakdown = new Map(apiUsage.breakdown);
            const current = breakdown.get(service) || 0;
            breakdown.set(service, current + cost);

            set({
              apiUsage: {
                ...apiUsage,
                totalCost: apiUsage.totalCost + cost,
                breakdown
              }
            });
          } catch (error) {
            logger.error('[UserStore] Failed to update API usage:', error);
          }
        },
        setMonthlyLimit: (limit) => {
          set(state => ({
            apiUsage: { ...state.apiUsage, monthlyLimit: limit }
          }));
        },
        resetMonthlyUsage: async () => {
          const currentMonth = new Date().toISOString().substring(0, 7);
          set(state => ({
            apiUsage: {
              ...state.apiUsage,
              totalCost: 0,
              currentMonth,
              breakdown: new Map()
            }
          }));
        },

        // Feature Flags
        featureFlags: new Map([
          ['conversationalInterface', true],
          ['knowledgeGraph', false],
          ['advancedExport', false],
          ['voiceCommands', false],
          ['collaborationTools', false],
          ['aiInsights', true],
          ['customAgents', false]
        ]),
        setFeatureFlag: (flag, enabled) => {
          const flags = new Map(get().featureFlags);
          flags.set(flag, enabled);
          set({ featureFlags: flags });
        },
        isFeatureEnabled: (flag) => {
          return get().featureFlags.get(flag) || false;
        },

        // Session Management
        sessionStartTime: Date.now(),
        lastSyncTime: null,
        startSession: () => {
          set({ sessionStartTime: Date.now() });
          get().updateProfile({ lastActive: new Date().toISOString() });
        },
        endSession: () => {
          const sessionDuration = Date.now() - get().sessionStartTime;
          logger.debug(`[UserStore] Session ended. Duration: ${Math.round(sessionDuration / 1000)}s`);
        },
        updateLastSync: () => {
          set({ lastSyncTime: Date.now() });
        }
      }),
      {
        name: 'user-store',
        partialize: (state) => ({
          profile: state.profile,
          notifications: state.notifications,
          privacy: state.privacy,
          research: state.research,
          exportPrefs: state.exportPrefs,
          apiUsage: {
            monthlyLimit: state.apiUsage.monthlyLimit,
            currentMonth: state.apiUsage.currentMonth
          },
          featureFlags: Array.from(state.featureFlags.entries())
        }),
        onRehydrateStorage: () => (state) => {
          if (state && state.featureFlags && Array.isArray(state.featureFlags)) {
            state.featureFlags = new Map(state.featureFlags as any);
          }
          if (state && !state.apiUsage.breakdown) {
            state.apiUsage.breakdown = new Map();
          }
        }
      }
    )
  )
);

// Helper hook for checking feature availability
export const useFeature = (featureName: string): boolean => {
  return useUserStore(state => state.isFeatureEnabled(featureName));
};

// Helper hook for checking if user is within API budget
export const useApiBudget = () => {
  const { apiUsage, research } = useUserStore();
  const remaining = research.maxAgentBudget - apiUsage.totalCost;
  const percentUsed = (apiUsage.totalCost / research.maxAgentBudget) * 100;

  return {
    used: apiUsage.totalCost,
    limit: research.maxAgentBudget,
    remaining: Math.max(0, remaining),
    percentUsed: Math.min(100, percentUsed),
    isOverBudget: apiUsage.totalCost >= research.maxAgentBudget
  };
};