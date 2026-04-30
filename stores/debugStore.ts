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
  simulateAllStorage: boolean;
  
  // Actions
  setFeatureOverride: (key: string, state: OverrideState) => void;
  setPanelTab: (tab: DebugState['panelTab']) => void;
  setShowBanner: (show: boolean) => void;
  setSimulateAllStorage: (enabled: boolean) => void;
  resetOverrides: () => void;
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      featureOverrides: {},
      panelTab: 'role',
      showBanner: true,
      simulateAllStorage: false,

      setFeatureOverride: (key, state) => set((s) => ({
        featureOverrides: {
          ...s.featureOverrides,
          [key]: state,
        }
      })),

      setPanelTab: (panelTab) => set({ panelTab }),
      setShowBanner: (showBanner) => set({ showBanner }),
      setSimulateAllStorage: (simulateAllStorage) => set({ simulateAllStorage }),
      
      resetOverrides: () => set({ featureOverrides: {}, simulateAllStorage: false }),
    }),
    {
      name: 'debug-storage-v4', // Increment version
    }
  )
);
