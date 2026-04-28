import { useCallback, useEffect, useMemo, useState } from 'react';
import { ordersService } from '../services/ordersService';
import { useOrderBranchScope } from './useOrderBranchScope';

const REFRESH_MS = 60_000;

/**
 * จำนวนออเดอร์ในคิว "แบ่งส่ง" (นิยาม B: มี allocation แล้ว + ยังมีของเหลือที่ยังไม่จัดครบ)
 * ใช้แสดง badge ที่เมนูฝ่ายขนส่ง — สอดคล้องกับหน้า PartialDeliveryOrdersView / usePartialOrders
 */
export function usePartialDeliveryQueueCount(enabled: boolean) {
  const orderScope = useOrderBranchScope();
  const [count, setCount] = useState(0);

  const filters = useMemo(() => {
    if (orderScope.loading) return { branchesIn: [] as string[] };
    if (orderScope.unrestricted) return undefined;
    return { branchesIn: orderScope.allowedBranches };
  }, [orderScope.loading, orderScope.unrestricted, orderScope.allowedBranches]);

  const fetchCount = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const n = await ordersService.getPartiallyDeliveredOrderCount(filters);
      setCount(n);
    } catch {
      setCount(0);
    }
  }, [enabled, filters]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    void fetchCount();
    const id = window.setInterval(() => void fetchCount(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled, fetchCount]);

  return { count, refetch: fetchCount };
}
