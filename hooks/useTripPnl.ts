/**
 * useTripPnl — โหลดรายการ Trip P&L ตามช่วงวันที่และรถ (Phase 4)
 */
import { useState, useEffect, useCallback } from 'react';
import { getTripPnlList, type TripPnlRow, type TripPnlOptions } from '../services/reports/tripPnlService';

export function useTripPnl(options: {
  startDate: string;
  endDate: string;
  vehicleId?: string | null;
  enabled?: boolean;
}) {
  const { startDate, endDate, vehicleId = null, enabled = true } = options;
  const [rows, setRows] = useState<TripPnlRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate || !enabled) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const opts: TripPnlOptions = { startDate, endDate, vehicleId: vehicleId || undefined };
      const data = await getTripPnlList(opts);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('โหลดรายงาน Trip P&L ไม่ได้'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, vehicleId, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { rows, loading, error, refetch: fetchData };
}
