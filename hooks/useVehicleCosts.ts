/**
 * useVehicleCosts — ดึงรายการต้นทุนคงที่และต้นทุนผันแปรของรถ (สำหรับ VehicleCostManager)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  vehicleCostService,
  type VehicleCostSummaryPhase2,
} from '../services/vehicleCostService';
import type { Database } from '../types/database';

type VehicleFixedCostRow = Database['public']['Tables']['vehicle_fixed_costs']['Row'];
type VehicleVariableCostRow = Database['public']['Tables']['vehicle_variable_costs']['Row'];

interface UseVehicleCostsOptions {
  vehicleId: string | null;
  /** ช่วงวันที่สำหรับสรุปต้นทุน (ถ้าไม่ส่งจะไม่โหลด summary) */
  dateRange?: { start: string; end: string } | null;
  autoFetch?: boolean;
}

export function useVehicleCosts({
  vehicleId,
  dateRange = null,
  autoFetch = true,
}: UseVehicleCostsOptions) {
  const [fixedCosts, setFixedCosts] = useState<VehicleFixedCostRow[]>([]);
  const [variableCosts, setVariableCosts] = useState<VehicleVariableCostRow[]>([]);
  const [summary, setSummary] = useState<VehicleCostSummaryPhase2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLists = useCallback(async () => {
    if (!vehicleId) {
      setFixedCosts([]);
      setVariableCosts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [fixed, variable] = await Promise.all([
        vehicleCostService.listFixedCosts(vehicleId),
        vehicleCostService.listVariableCosts(vehicleId),
      ]);
      setFixedCosts(fixed);
      setVariableCosts(variable);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch costs'));
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  const fetchSummary = useCallback(async () => {
    if (!vehicleId || !dateRange) {
      setSummary(null);
      return;
    }
    try {
      const result = await vehicleCostService.getVehicleCostSummaryPhase2({
        vehicleId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      setSummary(result);
    } catch {
      setSummary(null);
    }
  }, [vehicleId, dateRange?.start, dateRange?.end]);

  useEffect(() => {
    if (autoFetch) fetchLists();
  }, [autoFetch, fetchLists]);

  useEffect(() => {
    if (vehicleId && dateRange) fetchSummary();
    else setSummary(null);
  }, [vehicleId, dateRange, fetchSummary]);

  const refetch = useCallback(() => {
    fetchLists();
    if (vehicleId && dateRange) fetchSummary();
  }, [fetchLists, vehicleId, dateRange, fetchSummary]);

  return {
    fixedCosts,
    variableCosts,
    summary,
    loading,
    error,
    refetch,
  };
}
