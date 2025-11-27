// Reports Hooks
import { useState, useEffect } from 'react';
import { reportsService } from '../services/reportsService';
import type {
  MonthlyFuelReport,
  VehicleFuelComparison,
  FuelTrend,
  MonthlyTripReport,
  VehicleTripSummary,
  DriverTripReport,
  MonthlyMaintenanceReport,
  VehicleMaintenanceComparison,
  VehicleMaintenanceHistory,
  CostAnalysis,
  CostPerKm,
  MonthlyCostTrend,
} from '../services/reportsService';

// Fuel Reports Hooks
export const useMonthlyFuelReport = (months: number = 6) => {
  const [data, setData] = useState<MonthlyFuelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyFuelReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyFuelReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleFuelComparison = (months: number = 6) => {
  const [data, setData] = useState<VehicleFuelComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleFuelComparison(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleFuelComparison] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useFuelTrend = (months: number = 6) => {
  const [data, setData] = useState<FuelTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getFuelTrend(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useFuelTrend] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

// Trip Reports Hooks
export const useMonthlyTripReport = (months: number = 6) => {
  const [data, setData] = useState<MonthlyTripReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyTripReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyTripReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleTripSummary = (months: number = 6) => {
  const [data, setData] = useState<VehicleTripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleTripSummary(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleTripSummary] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useDriverTripReport = (months: number = 6) => {
  const [data, setData] = useState<DriverTripReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getDriverTripReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useDriverTripReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

// Maintenance Reports Hooks
export const useMonthlyMaintenanceReport = (months: number = 6) => {
  const [data, setData] = useState<MonthlyMaintenanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyMaintenanceReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyMaintenanceReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleMaintenanceComparison = (months: number = 6) => {
  const [data, setData] = useState<VehicleMaintenanceComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleMaintenanceComparison(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleMaintenanceComparison] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleMaintenanceHistory = (vehicleId: string | null) => {
  const [data, setData] = useState<VehicleMaintenanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      setData([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleMaintenanceHistory(vehicleId);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleMaintenanceHistory] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [vehicleId]);

  return { data, loading, error };
};

// Cost Analysis Hooks
export const useCostAnalysis = (startDate: Date, endDate: Date) => {
  const [data, setData] = useState<CostAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getCostAnalysis(startDate, endDate);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useCostAnalysis] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  return { data, loading, error };
};

export const useCostPerKm = (months: number = 6) => {
  const [data, setData] = useState<CostPerKm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getCostPerKm(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useCostPerKm] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useMonthlyCostTrend = (months: number = 6) => {
  const [data, setData] = useState<MonthlyCostTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyCostTrend(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyCostTrend] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

