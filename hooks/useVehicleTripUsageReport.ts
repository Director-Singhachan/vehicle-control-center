// useVehicleTripUsageReport.ts
// Hook สำหรับดึงข้อมูลรายงานการใช้รถรายวัน ต่อ vehicle_id และช่วงวันที่
import { useState, useEffect, useCallback } from 'react';
import {
  vehicleTripUsageService,
  type VehicleTripDailySummary,
  type VehicleProductSummaryItem,
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
  const [productSummary, setProductSummary] = useState<VehicleProductSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!vehicleId || !startDate || !endDate) {
      setDailySummaries([]);
      setProductSummary([]);
      return;
    }

    setLoading(true);
    setError(null);

    const options = { vehicleId, startDate, endDate };

    try {
      const [dailyResult, productResult] = await Promise.all([
        vehicleTripUsageService.getVehicleDailyUsage(options),
        vehicleTripUsageService.getVehicleProductSummary(options),
      ]);
      setDailySummaries(dailyResult);
      setProductSummary(productResult);
    } catch (err) {
      console.error('[useVehicleTripUsageReport] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setDailySummaries([]);
      setProductSummary([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    dailySummaries,
    productSummary,
    loading,
    error,
    refetch: fetchData,
  };
};
