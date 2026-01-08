import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type ViewMode = 'compact' | 'comfortable' | 'expanded';
type SidebarPosition = 'left' | 'right';

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

interface UIStore {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Layout
  sidebarOpen: boolean;
  sidebarPosition: SidebarPosition;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarPosition: (position: SidebarPosition) => void;

  // Chat UI
  chatPanelOpen: boolean;
  chatPanelWidth: number;
  chatViewMode: ViewMode;
  showChatContext: boolean;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setChatPanelWidth: (width: number) => void;
  setChatViewMode: (mode: ViewMode) => void;
  toggleChatContext: () => void;

  // Findings UI
  findingsViewMode: ViewMode;
  findingsGridColumns: number;
  showFindingsFilters: boolean;
  expandedFindings: Set<string>;
  setFindingsViewMode: (mode: ViewMode) => void;
  setFindingsGridColumns: (columns: number) => void;
  toggleFindingsFilters: () => void;
  toggleFindingExpanded: (findingId: string) => void;
  expandAllFindings: () => void;
  collapseAllFindings: () => void;

  // Digest UI
  digestViewMode: 'summary' | 'detailed' | 'timeline';
  expandedDigestSections: Set<string>;
  setDigestViewMode: (mode: 'summary' | 'detailed' | 'timeline') => void;
  toggleDigestSection: (sectionId: string) => void;

  // Modal/Dialog State
  activeModal: string | null;
  modalData: any;
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;

  // Toast Notifications
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void;
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;

  // Loading States
  loadingStates: Map<string, boolean>;
  setLoading: (key: string, isLoading: boolean) => void;
  isLoading: (key: string) => boolean;

  // Preferences
  animations: boolean;
  soundEffects: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
  setAnimations: (enabled: boolean) => void;
  setSoundEffects: (enabled: boolean) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;

  // Keyboard Shortcuts
  shortcutsEnabled: boolean;
  customShortcuts: Map<string, string>;
  setShortcutsEnabled: (enabled: boolean) => void;
  setCustomShortcut: (action: string, shortcut: string) => void;
  resetShortcuts: () => void;

  // Tutorial/Onboarding
  tutorialCompleted: boolean;
  tutorialStep: number;
  tooltipsEnabled: boolean;
  setTutorialCompleted: (completed: boolean) => void;
  setTutorialStep: (step: number) => void;
  setTooltipsEnabled: (enabled: boolean) => void;

  // Focus Mode
  focusMode: boolean;
  focusedElement: string | null;
  toggleFocusMode: () => void;
  setFocusedElement: (elementId: string | null) => void;
}

const defaultShortcuts = new Map([
  ['openChat', 'cmd+k'],
  ['toggleSidebar', 'cmd+b'],
  ['search', 'cmd+f'],
  ['newChat', 'cmd+n'],
  ['closeModal', 'esc'],
  ['save', 'cmd+s'],
  ['export', 'cmd+e'],
  ['refresh', 'cmd+r']
]);

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Theme
        theme: 'system',
        setTheme: (theme) => {
          set({ theme });
          // Apply theme to document
          if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        },

        // Layout
        sidebarOpen: true,
        sidebarPosition: 'left',
        toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        setSidebarPosition: (position) => set({ sidebarPosition: position }),

        // Chat UI
        chatPanelOpen: false,
        chatPanelWidth: 400,
        chatViewMode: 'comfortable',
        showChatContext: true,
        toggleChatPanel: () => set(state => ({ chatPanelOpen: !state.chatPanelOpen })),
        setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
        setChatPanelWidth: (width) => set({ chatPanelWidth: Math.max(300, Math.min(800, width)) }),
        setChatViewMode: (mode) => set({ chatViewMode: mode }),
        toggleChatContext: () => set(state => ({ showChatContext: !state.showChatContext })),

        // Findings UI
        findingsViewMode: 'comfortable',
        findingsGridColumns: 2,
        showFindingsFilters: false,
        expandedFindings: new Set(),
        setFindingsViewMode: (mode) => set({ findingsViewMode: mode }),
        setFindingsGridColumns: (columns) => set({ findingsGridColumns: Math.max(1, Math.min(4, columns)) }),
        toggleFindingsFilters: () => set(state => ({ showFindingsFilters: !state.showFindingsFilters })),
        toggleFindingExpanded: (findingId) => {
          const expanded = new Set(get().expandedFindings);
          if (expanded.has(findingId)) {
            expanded.delete(findingId);
          } else {
            expanded.add(findingId);
          }
          set({ expandedFindings: expanded });
        },
        expandAllFindings: () => {
          // This would need to be populated with actual finding IDs
          set({ expandedFindings: new Set() });
        },
        collapseAllFindings: () => set({ expandedFindings: new Set() }),

        // Digest UI
        digestViewMode: 'summary',
        expandedDigestSections: new Set(['executiveSummary']),
        setDigestViewMode: (mode) => set({ digestViewMode: mode }),
        toggleDigestSection: (sectionId) => {
          const expanded = new Set(get().expandedDigestSections);
          if (expanded.has(sectionId)) {
            expanded.delete(sectionId);
          } else {
            expanded.add(sectionId);
          }
          set({ expandedDigestSections: expanded });
        },

        // Modal/Dialog State
        activeModal: null,
        modalData: null,
        openModal: (modalId, data) => set({ activeModal: modalId, modalData: data }),
        closeModal: () => set({ activeModal: null, modalData: null }),

        // Toast Notifications
        toasts: [],
        showToast: (toast) => {
          const id = `toast_${Date.now()}_${Math.random()}`;
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
        dismissToast: (toastId) => {
          set(state => ({
            toasts: state.toasts.filter(t => t.id !== toastId)
          }));
        },
        clearToasts: () => set({ toasts: [] }),

        // Loading States
        loadingStates: new Map(),
        setLoading: (key, isLoading) => {
          const states = new Map(get().loadingStates);
          if (isLoading) {
            states.set(key, true);
          } else {
            states.delete(key);
          }
          set({ loadingStates: states });
        },
        isLoading: (key) => get().loadingStates.get(key) || false,

        // Preferences
        animations: true,
        soundEffects: false,
        autoSave: true,
        autoSaveInterval: 30000, // 30 seconds
        fontSize: 'medium',
        highContrast: false,
        reducedMotion: false,
        setAnimations: (enabled) => set({ animations: enabled }),
        setSoundEffects: (enabled) => set({ soundEffects: enabled }),
        setAutoSave: (enabled) => set({ autoSave: enabled }),
        setAutoSaveInterval: (interval) => set({ autoSaveInterval: Math.max(10000, interval) }),
        setFontSize: (size) => {
          set({ fontSize: size });
          // Apply to document
          document.documentElement.setAttribute('data-font-size', size);
        },
        setHighContrast: (enabled) => {
          set({ highContrast: enabled });
          // Apply to document
          if (enabled) {
            document.documentElement.classList.add('high-contrast');
          } else {
            document.documentElement.classList.remove('high-contrast');
          }
        },
        setReducedMotion: (enabled) => {
          set({ reducedMotion: enabled });
          // Apply to document
          if (enabled) {
            document.documentElement.classList.add('reduce-motion');
          } else {
            document.documentElement.classList.remove('reduce-motion');
          }
        },

        // Keyboard Shortcuts
        shortcutsEnabled: true,
        customShortcuts: new Map(),
        setShortcutsEnabled: (enabled) => set({ shortcutsEnabled: enabled }),
        setCustomShortcut: (action, shortcut) => {
          const shortcuts = new Map(get().customShortcuts);
          shortcuts.set(action, shortcut);
          set({ customShortcuts: shortcuts });
        },
        resetShortcuts: () => set({ customShortcuts: new Map() }),

        // Tutorial/Onboarding
        tutorialCompleted: false,
        tutorialStep: 0,
        tooltipsEnabled: true,
        setTutorialCompleted: (completed) => set({ tutorialCompleted: completed }),
        setTutorialStep: (step) => set({ tutorialStep: step }),
        setTooltipsEnabled: (enabled) => set({ tooltipsEnabled: enabled }),

        // Focus Mode
        focusMode: false,
        focusedElement: null,
        toggleFocusMode: () => set(state => ({
          focusMode: !state.focusMode,
          focusedElement: state.focusMode ? null : state.focusedElement
        })),
        setFocusedElement: (elementId) => set({ focusedElement: elementId })
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarPosition: state.sidebarPosition,
          chatViewMode: state.chatViewMode,
          findingsViewMode: state.findingsViewMode,
          findingsGridColumns: state.findingsGridColumns,
          digestViewMode: state.digestViewMode,
          animations: state.animations,
          soundEffects: state.soundEffects,
          autoSave: state.autoSave,
          autoSaveInterval: state.autoSaveInterval,
          fontSize: state.fontSize,
          highContrast: state.highContrast,
          reducedMotion: state.reducedMotion,
          shortcutsEnabled: state.shortcutsEnabled,
          customShortcuts: Array.from(state.customShortcuts.entries()),
          tutorialCompleted: state.tutorialCompleted,
          tutorialStep: state.tutorialStep,
          tooltipsEnabled: state.tooltipsEnabled
        }),
        onRehydrateStorage: () => (state) => {
          if (state && state.customShortcuts && Array.isArray(state.customShortcuts)) {
            state.customShortcuts = new Map(state.customShortcuts as any);
          }
        }
      }
    )
  )
);

// Helper hook for getting effective shortcuts
export const useShortcuts = () => {
  const { customShortcuts, shortcutsEnabled } = useUIStore();

  if (!shortcutsEnabled) return new Map();

  const effectiveShortcuts = new Map(defaultShortcuts);
  customShortcuts.forEach((shortcut, action) => {
    effectiveShortcuts.set(action, shortcut);
  });

  return effectiveShortcuts;
};