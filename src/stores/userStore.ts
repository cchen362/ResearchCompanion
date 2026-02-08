import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { UserPreferences } from '../types';
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

        // Feature Flags
        featureFlags: new Map([
          ['conversationalInterface', true],
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
          featureFlags: Array.from(state.featureFlags.entries())
        }),
        onRehydrateStorage: () => (state) => {
          if (state && state.featureFlags && Array.isArray(state.featureFlags)) {
            state.featureFlags = new Map(state.featureFlags as any);
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

