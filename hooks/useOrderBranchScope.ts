import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AppRole, Database } from '../types/database';
import { useAuth } from './useAuth';
import {
  normalizeProfileBranch,
  resolveOrderBranchScope,
  type OrderBranchScope,
} from '../utils/orderUserScope';

type OrderBranchVisibility = Database['public']['Enums']['order_branch_visibility'];

/**
 * Scope สำหรับสร้าง/แก้ไข/ดูออเดอร์ — อิง role_order_branch_scope ถ้ามีแถวตรง (role + สาขาโปรไฟล์);
 * ถ้าไม่มีแถวใช้กฎเดิม (ผู้บริหาร + สาขา HQ ในโปรไฟล์ = ไม่จำกัด, อื่นๆ ตามสาขาโปรไฟล์)
 */
export function useOrderBranchScope(): OrderBranchScope & { refetch: () => Promise<void> } {
  const { profile } = useAuth();
  const [dbVisibility, setDbVisibility] = useState<OrderBranchVisibility | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.role) {
      setDbVisibility(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profileBranch = normalizeProfileBranch(profile.branch);
      const { data, error } = await supabase
        .from('role_order_branch_scope')
        .select('visibility')
        .eq('role', profile.role as AppRole)
        .eq('profile_branch', profileBranch)
        .maybeSingle();

      if (error) {
        console.warn('[useOrderBranchScope]', error.message);
        setDbVisibility(null);
      } else {
        setDbVisibility(data?.visibility ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.branch]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopeResolved = useMemo(
    () =>
      resolveOrderBranchScope(profile, dbVisibility ?? null, loading || dbVisibility === undefined),
    [profile, dbVisibility, loading],
  );

  return useMemo(
    () => ({ ...scopeResolved, refetch: load }),
    [scopeResolved, load],
  );
}
