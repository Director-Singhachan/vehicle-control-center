/**
 * useFleetPnl — โหลดสรุป P&L ทั้งกองรถ (Phase 6)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getFleetPnlSummary,
  getFleetPnlMonthly,
  type FleetPnlResult,
  type FleetPnlMonthlyRow,
} from '../services/reports/fleetPnlService';

export function useFleetPnl(options: {
  startDate: string;
  endDate: string;
  /** กรองเฉพาะรถในสาขา — ส่ง vehicleIds จาก vehicles ที่ branch ตรง */
  vehicleIds?: string[] | null;
  enabled?: boolean;
}) {
  const { startDate, endDate, vehicleIds, enabled = true } = options;
  const [data, setData] = useState<FleetPnlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate || !enabled) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getFleetPnlSummary({ startDate, endDate, vehicleIds });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('โหลด Fleet P&L ไม่ได้'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, vehicleIds, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * useFleetPnlMonthly — โหลดสรุป P&L ทั้งกองรถแยกรายเดือน (Phase 7)
 */
export function useFleetPnlMonthly(options: {
  startDate: string;
  endDate: string;
  vehicleIds?: string[] | null;
  enabled?: boolean;
}) {
  const { startDate, endDate, vehicleIds, enabled = true } = options;
  const [data, setData] = useState<FleetPnlMonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate || !enabled) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getFleetPnlMonthly({ startDate, endDate, vehicleIds });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('โหลด Fleet P&L รายเดือนไม่ได้'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, vehicleIds, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
