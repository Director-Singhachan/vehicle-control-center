import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { AppRole } from '../types/database';
import type { AccessLevel, FeatureKey } from '../types/featureAccess';
import {
  accessLevelAtLeast,
  FEATURE_KEYS,
  FEATURE_MATRIX_SURVIVAL_KEYS,
  builtInLevel,
  isPrivilegedRole,
  resolveAccessLevel,
  TAB_TO_PRIMARY_FEATURE,
} from '../types/featureAccess';

/** สิทธิ์จากเมทริกซ์ (role_feature_access + built-in) ใช้กันเมนู/หน้าในแอป — ไม่ได้แทน RLS บนตารางธุรกรรม */
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
  const [fetchFailed, setFetchFailed] = useState(false);
  /** role ที่โหลด matrix สำเร็จล่าสุด — ใช้ไม่ให้ล้าง dbMap เมื่อ refetch ชั่วคราวล้มเหลว (กันเด้งแท็บ) */
  const successfulMatrixRoleRef = useRef<AppRole | null>(null);

  const load = useCallback(async () => {
    if (!appRole) {
      successfulMatrixRoleRef.current = null;
      setDbMap({});
      setFetchFailed(false);
      setLoading(false);
      return;
    }

    if (successfulMatrixRoleRef.current !== appRole) {
      successfulMatrixRoleRef.current = null;
      setDbMap({});
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_feature_access')
        .select('feature_key, access_level')
        .eq('role', appRole);

      if (error) {
        console.warn('[useFeatureAccess] fetch skipped or failed:', error.message);
        if (successfulMatrixRoleRef.current === appRole) {
          setFetchFailed(false);
        } else {
          setFetchFailed(true);
        }
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
      setFetchFailed(false);
      successfulMatrixRoleRef.current = appRole;
    } finally {
      setLoading(false);
    }
  }, [appRole]);

  useEffect(() => {
    void load();
  }, [load]);

  /** มีแถวใน DB อย่างน้อยหนึ่งแถว = ใช้ matrix แบบครบ: ช่องว่าง = none (ไม่ดึง built-in ทั้งบทบาท) */
  const roleHasDbCustomization = useMemo(
    () => !loading && Object.keys(dbMap).length > 0,
    [loading, dbMap],
  );

  const levelFor = useCallback(
    (feature: FeatureKey): AccessLevel => {
      if (fetchFailed && appRole && !isPrivilegedRole(appRole)) {
        if (FEATURE_MATRIX_SURVIVAL_KEYS.includes(feature)) {
          return builtInLevel(appRole, feature);
        }
        return 'none';
      }
      return resolveAccessLevel(appRole, feature, dbMap[feature], {
        roleHasDbCustomization,
      });
    },
    [appRole, dbMap, fetchFailed, roleHasDbCustomization],
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
