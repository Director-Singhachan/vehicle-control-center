/**
 * useFleetPnl — โหลดสรุป P&L ทั้งกองรถ (Phase 6)
 */
import { useState, useEffect, useCallback } from 'react';
import { getFleetPnlSummary, type FleetPnlResult } from '../services/reports/fleetPnlService';

export function useFleetPnl(options: {
  startDate: string;
  endDate: string;
  enabled?: boolean;
}) {
  const { startDate, endDate, enabled = true } = options;
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
      const result = await getFleetPnlSummary({ startDate, endDate });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('โหลด Fleet P&L ไม่ได้'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
