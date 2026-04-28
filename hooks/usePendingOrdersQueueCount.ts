import { useCallback, useEffect, useMemo, useState } from 'react';
import { ordersService } from '../services/ordersService';
import { useFeatureAccess } from './useFeatureAccess';
import { useOrderBranchScope } from './useOrderBranchScope';

const REFRESH_MS = 60_000;

/**
 * จำนวนออเดอร์ในหน้ารอจัดทริป — ขอบเขตสาขาตาม useOrderBranchScope (เหมือนหน้า PendingOrdersView)
 */
export function usePendingOrdersQueueCount(enabled: boolean) {
  const { can, loading: featureAccessLoading } = useFeatureAccess();
  const orderScope = useOrderBranchScope();
  const canView = can('tab.pending_orders', 'view');

  const filters = useMemo(() => {
    if (!enabled || featureAccessLoading || !canView || orderScope.loading) {
      return { branchesIn: [] as string[] };
    }
    if (orderScope.unrestricted) return undefined;
    return { branchesIn: orderScope.allowedBranches };
  }, [
    enabled,
    featureAccessLoading,
    canView,
    orderScope.loading,
    orderScope.unrestricted,
    orderScope.allowedBranches,
  ]);

  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!enabled || !canView) {
      setCount(0);
      return;
    }
    try {
      const n = await ordersService.getPendingOrdersCount(filters);
      setCount(n);
    } catch {
      setCount(0);
    }
  }, [enabled, canView, filters]);

  useEffect(() => {
    if (!enabled || !canView) {
      setCount(0);
      return;
    }
    void fetchCount();
    const id = window.setInterval(() => void fetchCount(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled, canView, fetchCount]);

  return { count, refetch: fetchCount };
}
