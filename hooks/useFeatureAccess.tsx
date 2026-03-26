import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { AppRole } from '../types/database';
import type { AccessLevel, FeatureKey } from '../types/featureAccess';
import {
  accessLevelAtLeast,
  FEATURE_KEYS,
  resolveAccessLevel,
  TAB_TO_PRIMARY_FEATURE,
} from '../types/featureAccess';

export interface UseFeatureAccessResult {
  appRole: AppRole | null;
  levelFor: (feature: FeatureKey) => AccessLevel;
  can: (feature: FeatureKey, atLeast: AccessLevel) => boolean;
  canAccessTab: (tabId: string) => boolean;
  dbOverrideCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

const FeatureAccessContext = createContext<UseFeatureAccessResult | null>(null);

function useFeatureAccessState(): UseFeatureAccessResult {
  const { profile } = useAuth();
  const appRole = (profile?.role as AppRole) ?? null;
  const [dbMap, setDbMap] = useState<Partial<Record<FeatureKey, AccessLevel>>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!appRole) {
      setDbMap({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_feature_access')
        .select('feature_key, access_level')
        .eq('role', appRole);

      if (error) {
        console.warn('[useFeatureAccess] fetch skipped or failed:', error.message);
        setDbMap({});
        return;
      }
      const next: Partial<Record<FeatureKey, AccessLevel>> = {};
      for (const row of data ?? []) {
        const fk = row.feature_key as FeatureKey;
        if (FEATURE_KEYS.includes(fk)) {
          next[fk] = row.access_level as AccessLevel;
        }
      }
      setDbMap(next);
    } finally {
      setLoading(false);
    }
  }, [appRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const levelFor = useCallback(
    (feature: FeatureKey): AccessLevel => {
      return resolveAccessLevel(appRole, feature, dbMap[feature]);
    },
    [appRole, dbMap],
  );

  const can = useCallback(
    (feature: FeatureKey, atLeast: AccessLevel): boolean => {
      return accessLevelAtLeast(levelFor(feature), atLeast);
    },
    [levelFor],
  );

  const canAccessTab = useCallback(
    (tabId: string): boolean => {
      const feature = TAB_TO_PRIMARY_FEATURE[tabId];
      if (!feature) return true;
      return accessLevelAtLeast(levelFor(feature), 'view');
    },
    [levelFor],
  );

  const dbOverrideCount = useMemo(() => Object.keys(dbMap).length, [dbMap]);

  return {
    appRole,
    levelFor,
    can,
    canAccessTab,
    dbOverrideCount,
    loading,
    refetch: load,
  };
}

export function FeatureAccessProvider({ children }: { children: React.ReactNode }) {
  const value = useFeatureAccessState();
  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
}

export function useFeatureAccess(): UseFeatureAccessResult {
  const ctx = useContext(FeatureAccessContext);
  if (!ctx) {
    throw new Error('useFeatureAccess must be used within FeatureAccessProvider');
  }
  return ctx;
}
