/**
 * useVehiclePnl — โหลดสรุป P&L รถ 1 คัน ในช่วงวันที่ (Phase 5)
 */
import { useState, useEffect, useCallback } from 'react';
import { getVehiclePnlSummary, type VehiclePnlSummary } from '../services/reports/vehiclePnlService';

export function useVehiclePnl(options: {
  vehicleId: string | null;
  startDate: string;
  endDate: string;
  enabled?: boolean;
}) {
  const { vehicleId, startDate, endDate, enabled = true } = options;
  const [summary, setSummary] = useState<VehiclePnlSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!vehicleId || !startDate || !endDate || !enabled) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getVehiclePnlSummary({ vehicleId, startDate, endDate });
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('โหลดสรุป P&L ไม่ได้'));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, startDate, endDate, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { summary, loading, error, refetch: fetchData };
}
