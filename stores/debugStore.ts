import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeatureFlags {
  enableBetaV2: boolean;
  showPerformanceStats: boolean;
  useExperimentalSidebar: boolean;
  debugApiLogs: boolean;
}

interface DebugState {
  featureFlags: FeatureFlags;
  panelTab: 'role' | 'inspector' | 'jump' | 'flags' | 'system';
  showBanner: boolean;
  
  // Actions
  toggleFlag: (key: keyof FeatureFlags) => void;
  setPanelTab: (tab: DebugState['panelTab']) => void;
  setShowBanner: (show: boolean) => void;
  resetFlags: () => void;
}

const DEFAULT_FLAGS: FeatureFlags = {
  enableBetaV2: false,
  showPerformanceStats: false,
  useExperimentalSidebar: false,
  debugApiLogs: false,
};

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      featureFlags: DEFAULT_FLAGS,
      panelTab: 'role',
      showBanner: true,

      toggleFlag: (key) => set((state) => ({
        featureFlags: {
          ...state.featureFlags,
          [key]: !state.featureFlags[key],
        }
      })),

      setPanelTab: (panelTab) => set({ panelTab }),
      setShowBanner: (showBanner) => set({ showBanner }),
      
      resetFlags: () => set({ featureFlags: DEFAULT_FLAGS }),
    }),
    {
      name: 'debug-storage',
    }
  )
);
