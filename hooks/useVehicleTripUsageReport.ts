// useVehicleTripUsageReport.ts
// Hook สำหรับดึงข้อมูลรายงานการใช้รถรายวัน ต่อ vehicle_id และช่วงวันที่
import { useState, useEffect, useCallback } from 'react';
import {
  vehicleTripUsageService,
  type VehicleTripDailySummary,
} from '../services/vehicleTripUsageService';

interface UseVehicleTripUsageReportParams {
  vehicleId: string | null;
  startDate: string;
  endDate: string;
}

export const useVehicleTripUsageReport = ({
  vehicleId,
  startDate,
  endDate,
}: UseVehicleTripUsageReportParams) => {
  const [dailySummaries, setDailySummaries] = useState<VehicleTripDailySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!vehicleId || !startDate || !endDate) {
      setDailySummaries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await vehicleTripUsageService.getVehicleDailyUsage({
        vehicleId,
        startDate,
        endDate,
      });
      setDailySummaries(result);
    } catch (err) {
      console.error('[useVehicleTripUsageReport] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setDailySummaries([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    dailySummaries,
    loading,
    error,
    refetch: fetchData,
  };
};
