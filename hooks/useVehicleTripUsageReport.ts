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
  const [productSummaryLoading, setProductSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!vehicleId || !startDate || !endDate) {
      setDailySummaries([]);
      setProductSummary([]);
      return;
    }

    setLoading(true);
    setProductSummaryLoading(true);
    setError(null);
    setProductSummary([]);

    const options = { vehicleId, startDate, endDate };

    try {
      // โหลดสรุปรายวันก่อน ให้ผู้ใช้เห็นตารางเร็ว
      const dailyResult = await vehicleTripUsageService.getVehicleDailyUsage(options);
      setDailySummaries(dailyResult);
    } catch (err) {
      console.error('[useVehicleTripUsageReport] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setDailySummaries([]);
      setProductSummaryLoading(false);
      return;
    } finally {
      setLoading(false);
    }

    // โหลดสรุปสินค้าในพื้นหลัง (ไม่บล็อก UI)
    try {
      const productResult = await vehicleTripUsageService.getVehicleProductSummary(options);
      setProductSummary(productResult);
    } catch (err) {
      console.error('[useVehicleTripUsageReport] Error fetching product summary:', err);
      setProductSummary([]);
    } finally {
      setProductSummaryLoading(false);
    }
  }, [vehicleId, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    dailySummaries,
    productSummary,
    loading,
    productSummaryLoading,
    error,
    refetch: fetchData,
  };
};
