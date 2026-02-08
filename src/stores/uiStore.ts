/**
 * UI Store - Zustand state management for interface state
 *
 * Phase 2 Refactoring: Centralized UI state management
 *
 * Key principles:
 * 1. Single source of truth for ALL loading states
 * 2. Centralized modal/drawer state management
 * 3. Progress tracking for async operations
 * 4. View settings that persist across sessions
 *
 * This store is NON-PERSISTENT by design (except view settings).
 * Loading states and modal states should reset on page refresh.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================
// Types
// ============================================

type LoadingKey = 'topics' | 'findings' | 'digest' | 'agents' | 'chat' | 'export';
type ModalKey = 'findingDetail' | 'sourceDrawer' | 'digestSettings' | 'topicEdit' | 'topicCreate' | 'agentMonitor';
type ViewMode = 'digest' | 'list';
type SortBy = 'date' | 'relevance' | 'source';
type FilterBy = 'all' | 'pubmed' | 'clinical' | 'web';

// Toast notification type
interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
  duration?: number;
  timestamp: number;
}

interface LoadingStates {
  topics: boolean;
  findings: boolean;
  digest: boolean;
  agents: boolean;
  chat: boolean;
  export: boolean;
}

interface ModalStates {
  findingDetail: boolean;
  sourceDrawer: boolean;
  digestSettings: boolean;
  topicEdit: boolean;
  topicCreate: boolean;
  agentMonitor: boolean;
}

interface ProgressState {
  digestProgress: number;
  digestMessage: string;
  agentProgress: Map<string, number>;
}

// Source drawer context - which theme's findings to show
interface SourceDrawerContext {
  digestThemeId: string | null;
  digestThemeName: string | null;
}

interface UIStore {
  // ============================================
  // Loading States (single source of truth)
  // ============================================
  loading: LoadingStates;

  // ============================================
  // Progress Tracking
  // ============================================
  digestProgress: number;
  digestMessage: string;
  agentProgress: Map<string, number>;

  // ============================================
  // Modals/Drawers
  // ============================================
  modals: ModalStates;
  sourceDrawerContext: SourceDrawerContext;
  modalData: any; // Generic data for modal content

  // ============================================
  // View Settings (persisted)
  // ============================================
  viewMode: ViewMode;
  sortBy: SortBy;
  filterBy: FilterBy;

  // ============================================
  // Chat Panel
  // ============================================
  chatPanelOpen: boolean;
  chatPanelWidth: number;
  chatFullscreen: boolean;

  // ============================================
  // Toast Notifications
  // ============================================
  toasts: Toast[];

  // ============================================
  // Actions - Loading
  // ============================================
  setLoading: (key: LoadingKey, value: boolean) => void;
  isLoading: (key: LoadingKey) => boolean;
  isAnyLoading: () => boolean;
  resetLoadingStates: () => void;

  // ============================================
  // Actions - Progress
  // ============================================
  setDigestProgress: (progress: number, message?: string) => void;
  setAgentProgress: (agentId: string, progress: number) => void;
  clearAgentProgress: (agentId: string) => void;
  resetProgress: () => void;

  // ============================================
  // Actions - Modals
  // ============================================
  openModal: (modal: ModalKey, data?: any) => void;
  closeModal: (modal: ModalKey) => void;
  closeAllModals: () => void;
  isModalOpen: (modal: ModalKey) => boolean;

  // ============================================
  // Actions - Source Drawer
  // ============================================
  openSourceDrawer: (digestThemeId?: string, digestThemeName?: string) => void;
  closeSourceDrawer: () => void;

  // ============================================
  // Actions - View Settings
  // ============================================
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sort: SortBy) => void;
  setFilterBy: (filter: FilterBy) => void;

  // ============================================
  // Actions - Chat Panel
  // ============================================
  setChatPanelOpen: (open: boolean) => void;
  toggleChatPanel: () => void;
  setChatPanelWidth: (width: number) => void;
  setChatFullscreen: (fullscreen: boolean) => void;
  toggleChatFullscreen: () => void;

  // ============================================
  // Actions - Toast Notifications
  // ============================================
  showToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void;
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;

  // ============================================
  // Reset
  // ============================================
  reset: () => void;
}

// Default states
const defaultLoading: LoadingStates = {
  topics: false,
  findings: false,
  digest: false,
  agents: false,
  chat: false,
  export: false
};

const defaultModals: ModalStates = {
  findingDetail: false,
  sourceDrawer: false,
  digestSettings: false,
  topicEdit: false,
  topicCreate: false,
  agentMonitor: false
};

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // ============================================
      // Initial State
      // ============================================
      loading: { ...defaultLoading },

      digestProgress: 0,
      digestMessage: '',
      agentProgress: new Map(),

      modals: { ...defaultModals },
      sourceDrawerContext: {
        digestThemeId: null,
        digestThemeName: null
      },
      modalData: null,

      viewMode: 'digest',
      sortBy: 'date',
      filterBy: 'all',

      chatPanelOpen: false,
      chatPanelWidth: 400,
      chatFullscreen: false,

      toasts: [],

      // ============================================
      // Loading Actions
      // ============================================

      setLoading: (key: LoadingKey, value: boolean) => {
        set(state => ({
          loading: { ...state.loading, [key]: value }
        }));
      },

      isLoading: (key: LoadingKey) => {
        return get().loading[key];
      },

      isAnyLoading: () => {
        const loading = get().loading;
        return Object.values(loading).some(v => v);
      },

      resetLoadingStates: () => {
        set({ loading: { ...defaultLoading } });
      },

      // ============================================
      // Progress Actions
      // ============================================

      setDigestProgress: (progress: number, message?: string) => {
        set({
          digestProgress: progress,
          digestMessage: message || ''
        });
      },

      setAgentProgress: (agentId: string, progress: number) => {
        set(state => ({
          agentProgress: new Map(state.agentProgress).set(agentId, progress)
        }));
      },

      clearAgentProgress: (agentId: string) => {
        set(state => {
          const newProgress = new Map(state.agentProgress);
          newProgress.delete(agentId);
          return { agentProgress: newProgress };
        });
      },

      resetProgress: () => {
        set({
          digestProgress: 0,
          digestMessage: '',
          agentProgress: new Map()
        });
      },

      // ============================================
      // Modal Actions
      // ============================================

      openModal: (modal: ModalKey, data?: any) => {
        const isRightPanel = modal === 'findingDetail' || modal === 'sourceDrawer';
        set(state => ({
          modals: { ...state.modals, [modal]: true },
          modalData: data !== undefined ? data : state.modalData,
          // Mutual exclusivity: close chat when a right-panel drawer opens
          ...(isRightPanel ? { chatPanelOpen: false } : {})
        }));
      },

      closeModal: (modal: ModalKey) => {
        set(state => ({
          modals: { ...state.modals, [modal]: false },
          // Clear modal data when closing
          modalData: null
        }));
      },

      closeAllModals: () => {
        set({
          modals: { ...defaultModals },
          modalData: null,
          sourceDrawerContext: {
            digestThemeId: null,
            digestThemeName: null
          }
        });
      },

      isModalOpen: (modal: ModalKey) => {
        return get().modals[modal];
      },

      // ============================================
      // Source Drawer Actions
      // ============================================

      openSourceDrawer: (digestThemeId?: string, digestThemeName?: string) => {
        set(state => ({
          modals: { ...state.modals, sourceDrawer: true },
          sourceDrawerContext: {
            digestThemeId: digestThemeId || null,
            digestThemeName: digestThemeName || null
          },
          // Mutual exclusivity: close chat when source drawer opens
          chatPanelOpen: false,
        }));
      },

      closeSourceDrawer: () => {
        set(state => ({
          modals: { ...state.modals, sourceDrawer: false },
          sourceDrawerContext: {
            digestThemeId: null,
            digestThemeName: null
          }
        }));
      },

      // ============================================
      // View Settings Actions
      // ============================================

      setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
      setSortBy: (sort: SortBy) => set({ sortBy: sort }),
      setFilterBy: (filter: FilterBy) => set({ filterBy: filter }),

      // ============================================
      // Chat Panel Actions
      // ============================================

      setChatPanelOpen: (open: boolean) => set(state => ({
        chatPanelOpen: open,
        // Mutual exclusivity: close right-panel drawers when chat opens
        ...(open ? {
          modals: {
            ...state.modals,
            findingDetail: false,
            sourceDrawer: false,
          },
          sourceDrawerContext: {
            digestThemeId: null,
            digestThemeName: null,
          },
          modalData: null,
        } : {})
      })),
      toggleChatPanel: () => set(state => {
        const willOpen = !state.chatPanelOpen;
        return {
          chatPanelOpen: willOpen,
          ...(willOpen ? {
            modals: {
              ...state.modals,
              findingDetail: false,
              sourceDrawer: false,
            },
            sourceDrawerContext: {
              digestThemeId: null,
              digestThemeName: null,
            },
            modalData: null,
          } : {})
        };
      }),
      setChatPanelWidth: (width: number) => set({ chatPanelWidth: Math.max(300, Math.min(800, width)) }),
      setChatFullscreen: (fullscreen: boolean) => set({ chatFullscreen: fullscreen }),
      toggleChatFullscreen: () => set(state => ({ chatFullscreen: !state.chatFullscreen })),

      // ============================================
      // Toast Actions
      // ============================================

      showToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = {
          ...toast,
          id,
          timestamp: Date.now()
        };

        set(state => ({ toasts: [...state.toasts, newToast] }));

        // Auto dismiss after duration (default 5 seconds)
        const duration = toast.duration || 5000;
        if (duration > 0) {
          setTimeout(() => {
            get().dismissToast(id);
          }, duration);
        }
      },

      dismissToast: (toastId: string) => {
        set(state => ({
          toasts: state.toasts.filter(t => t.id !== toastId)
        }));
      },

      clearToasts: () => set({ toasts: [] }),

      // ============================================
      // Reset
      // ============================================

      reset: () => {
        set({
          loading: { ...defaultLoading },
          digestProgress: 0,
          digestMessage: '',
          agentProgress: new Map(),
          modals: { ...defaultModals },
          sourceDrawerContext: {
            digestThemeId: null,
            digestThemeName: null
          },
          modalData: null,
          chatPanelOpen: false,
          chatFullscreen: false,
          toasts: []
          // Note: Don't reset view settings or chatPanelWidth - they should persist
        });
      }
    }),
    {
      name: 'ui-store-v2', // New name to avoid conflicts with old store
      storage: createJSONStorage(() => localStorage),
      // Only persist view settings, not loading/modal states
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        filterBy: state.filterBy
      })
    }
  )
);
