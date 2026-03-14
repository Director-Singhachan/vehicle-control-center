// useVehicleTripUsageReport.ts
// Hook สำหรับดึงข้อมูลรายงานการใช้รถรายวัน ต่อ vehicle_id และช่วงวันที่
import { useState, useEffect, useCallback } from 'react';
import {
  vehicleTripUsageService,
  type VehicleTripDailySummary,
  type VehicleProductSummaryItem,
  type VehicleCostSummary,
  type VehicleMonthlySummary,
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
  const [costSummary, setCostSummary] = useState<VehicleCostSummary | null>(null);
  const [monthlySummaries, setMonthlySummaries] = useState<VehicleMonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [productSummaryLoading, setProductSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!vehicleId || !startDate || !endDate) {
      setDailySummaries([]);
      setProductSummary([]);
      setCostSummary(null);
      setMonthlySummaries([]);
      return;
    }

    setLoading(true);
    setProductSummaryLoading(true);
    setError(null);
    setProductSummary([]);
    setCostSummary(null);
    setMonthlySummaries([]);

    const options = { vehicleId, startDate, endDate };

    try {
      // โหลดสรุปรายวัน + ต้นทุน + รายเดือน พร้อมกัน
      const [dailyResult, costResult, monthlyResult] = await Promise.all([
        vehicleTripUsageService.getVehicleDailyUsage(options),
        vehicleTripUsageService.getVehicleCostSummary(options),
        vehicleTripUsageService.getVehicleMonthlySummary(options),
      ]);
      setDailySummaries(dailyResult);
      setCostSummary(costResult);
      setMonthlySummaries(monthlyResult);
    } catch (err) {
      console.error('[useVehicleTripUsageReport] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setDailySummaries([]);
      setCostSummary(null);
      setMonthlySummaries([]);
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
    costSummary,
    monthlySummaries,
    loading,
    productSummaryLoading,
    error,
    refetch: fetchData,
  };
};
