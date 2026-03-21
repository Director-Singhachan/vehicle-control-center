import { useState, useEffect, useMemo, useRef } from 'react';
import {
  getTripContributionEstimate,
  type TripContributionEstimateResult,
} from '../services/deliveryTrip/tripContributionEstimateService';

export interface UseTripContributionEstimateParams {
  /** คำนวณเมื่อมีรถและเปิดใช้ (เช่น หลังโหลดฟอร์ม) */
  enabled: boolean;
  vehicleId: string;
  branch: string | null;
  plannedDate: string;
  tripStartDate: string;
  tripEndDate: string;
  crewStaffIds: string[];
  /** สตริงจาก input รายได้เที่ยว — ว่าง = ไม่ระบุ */
  tripRevenueStr: string;
  /** สตริงน้ำมันโดยประมาณ */
  estimatedFuelStr: string;
  excludeTripId?: string | null;
}

const DEBOUNCE_MS = 300;

export function useTripContributionEstimate(params: UseTripContributionEstimateParams): {
  data: TripContributionEstimateResult | null;
  loading: boolean;
  error: string | null;
} {
  const {
    enabled,
    vehicleId,
    branch,
    plannedDate,
    tripStartDate,
    tripEndDate,
    crewStaffIds,
    tripRevenueStr,
    estimatedFuelStr,
    excludeTripId,
  } = params;

  const [data, setData] = useState<TripContributionEstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = useMemo(
    () =>
      JSON.stringify({
        enabled,
        vehicleId,
        branch,
        plannedDate,
        tripStartDate,
        tripEndDate,
        crewStaffIds,
        tripRevenueStr,
        estimatedFuelStr,
        excludeTripId: excludeTripId ?? null,
      }),
    [
      enabled,
      vehicleId,
      branch,
      plannedDate,
      tripStartDate,
      tripEndDate,
      crewStaffIds,
      tripRevenueStr,
      estimatedFuelStr,
      excludeTripId,
    ]
  );

  const requestSeq = useRef(0);

  useEffect(() => {
    if (!enabled || !vehicleId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const seq = ++requestSeq.current;

    const timer = window.setTimeout(() => {
      const revenueParsed =
        tripRevenueStr.trim() === '' || Number.isNaN(Number(tripRevenueStr))
          ? null
          : Number(tripRevenueStr);
      const fuelParsed =
        estimatedFuelStr.trim() === '' || Number.isNaN(Number(estimatedFuelStr))
          ? 0
          : Math.max(0, Number(estimatedFuelStr));

      void getTripContributionEstimate({
        vehicleId,
        branch,
        plannedDate,
        tripStartDate: tripStartDate || null,
        tripEndDate: tripEndDate || null,
        crewStaffIds,
        revenue: revenueParsed,
        estimatedFuelBaht: fuelParsed,
        excludeTripId: excludeTripId ?? undefined,
      })
        .then((res) => {
          if (seq !== requestSeq.current) return;
          setData(res);
          setError(null);
        })
        .catch((err: unknown) => {
          if (seq !== requestSeq.current) return;
          setData(null);
          setError(err instanceof Error ? err.message : 'ไม่สามารถคำนวณประมาณการได้');
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      requestSeq.current += 1;
      setLoading(false);
    };
  }, [key, enabled, vehicleId]);

  return { data, loading, error };
}
