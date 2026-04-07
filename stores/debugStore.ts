import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeatureFlags {
  enableBetaV2: boolean;
  showPerformanceStats: boolean;
  useExperimentalSidebar: boolean;
  debugApiLogs: boolean;
}

export type OverrideState = 'default' | 'on' | 'off';

interface DebugState {
  featureOverrides: Record<string, OverrideState>;
  panelTab: 'role' | 'inspector' | 'jump' | 'flags' | 'system';
  showBanner: boolean;
  
  // Actions
  setFeatureOverride: (key: string, state: OverrideState) => void;
  setPanelTab: (tab: DebugState['panelTab']) => void;
  setShowBanner: (show: boolean) => void;
  resetOverrides: () => void;
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      featureOverrides: {},
      panelTab: 'role',
      showBanner: true,

      setFeatureOverride: (key, state) => set((s) => ({
        featureOverrides: {
          ...s.featureOverrides,
          [key]: state,
        }
      })),

      setPanelTab: (panelTab) => set({ panelTab }),
      setShowBanner: (showBanner) => set({ showBanner }),
      
      resetOverrides: () => set({ featureOverrides: {} }),
    }),
    {
      name: 'debug-storage-v2', // Increment version to clear old flags
    }
  )
);
