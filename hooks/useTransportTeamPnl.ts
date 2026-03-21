import { useState, useEffect, useCallback } from 'react';
import {
  getTransportTeamPnlSummary,
  type TransportTeamPnlSummary,
  type TransportTeamPnlOptions,
} from '../services/reports/transportTeamPnlService';

export function useTransportTeamPnl(
  options: TransportTeamPnlOptions & { enabled?: boolean }
): {
  data: TransportTeamPnlSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const {
    enabled = true,
    startDate,
    endDate,
    branch,
    includeDailyBreakdown,
  } = options;
  const [data, setData] = useState<TransportTeamPnlSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!enabled || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void getTransportTeamPnlSummary({
      startDate,
      endDate,
      branch,
      includeDailyBreakdown,
    })
      .then(setData)
      .catch((e: unknown) => {
        setData(null);
        setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => setLoading(false));
  }, [enabled, startDate, endDate, branch, includeDailyBreakdown]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
