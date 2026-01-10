// Custom hooks for fuel logs
import { useState, useEffect } from 'react';
import { fuelService } from '../services/fuelService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import type { Database } from '../types/database';

type FuelRecord = Database['public']['Tables']['fuel_records']['Row'];
type FuelRecordWithUser = FuelRecord & { user?: { full_name: string; email?: string; avatar_url?: string | null } };

export const useFuelLogs = (filters?: {
  vehicle_id?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  fuel_type?: string;
  limit?: number;
  offset?: number;
}) => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('fuel-logs', filters || {});

  const cached = cache.get<{ data: FuelRecordWithUser[]; count: number }>(cacheKey);
  const [fuelLogs, setFuelLogs] = useState<FuelRecordWithUser[]>(cached?.data || []);
  const [totalCount, setTotalCount] = useState<number>(cached?.count || 0);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const fetchFuelLogs = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<{ data: FuelRecordWithUser[]; count: number }>(cacheKey);
      if (cached !== null && cached !== undefined) {
        setFuelLogs(cached.data);
        setTotalCount(cached.count);
        setLoading(false);
        // Background refresh
        setTimeout(() => fetchFuelLogs(false), 100);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fuelService.getFuelHistory(filters);
      setFuelLogs(result.data);
      setTotalCount(result.count);
      // Cache for 2 minutes
      cache.set(cacheKey, result, 2 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch fuel logs'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFuelLogs();
  }, [JSON.stringify(filters)]);

  return {
    fuelLogs,
    totalCount,
    loading,
    error,
    refetch: () => fetchFuelLogs(false),
  };
};

export const useFuelStats = (filters?: {
  vehicle_id?: string;
  start_date?: string;
  end_date?: string;
  branch?: string;
}) => {
  const [stats, setStats] = useState<{
    totalCost: number;
    totalLiters: number;
    averagePricePerLiter: number;
    averageEfficiency: number | null;
    totalRecords: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fuelService.getFuelStats(filters);
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch fuel stats'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [JSON.stringify(filters)]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
};

export const useFuelEfficiencyAlerts = () => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('fuel-efficiency-alerts', {});

  const cached = cache.get<Array<{
    vehicle_id: string;
    vehicle_plate: string;
    vehicle_make: string | null;
    vehicle_model: string | null;
    current_efficiency: number;
    average_efficiency: number;
    efficiency_drop_percent: number;
    last_fill_date: string;
  }>>(cacheKey);

  const [alerts, setAlerts] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<typeof alerts>(cacheKey);
      if (cached !== null && cached !== undefined) {
        setAlerts(cached);
        setLoading(false);
        // Background refresh
        setTimeout(() => fetchAlerts(false), 100);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fuelService.getEfficiencyAlerts();
      setAlerts(result);
      // Cache for 5 minutes (alerts don't change frequently)
      cache.set(cacheKey, result, 5 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch efficiency alerts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  return {
    alerts,
    loading,
    error,
    refetch: () => fetchAlerts(false),
  };
};

export const useMonthlyFuelCosts = (months: number = 12) => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('monthly-fuel-costs', months);

  const cached = cache.get<Array<{
    month: string;
    total_cost: number;
    total_liters: number;
    average_price_per_liter: number;
    fill_count: number;
    vehicles: Array<{
      vehicle_id: string;
      plate: string;
      cost: number;
      liters: number;
    }>;
  }>>(cacheKey);

  const [monthlyCosts, setMonthlyCosts] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const fetchMonthlyCosts = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<typeof monthlyCosts>(cacheKey);
      if (cached !== null && cached !== undefined) {
        setMonthlyCosts(cached);
        setLoading(false);
        // Background refresh
        setTimeout(() => fetchMonthlyCosts(false), 100);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fuelService.getMonthlyFuelCosts(months);
      setMonthlyCosts(result);
      // Cache for 5 minutes
      cache.set(cacheKey, result, 5 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch monthly fuel costs'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyCosts();
  }, [months]);

  return {
    monthlyCosts,
    loading,
    error,
    refetch: () => fetchMonthlyCosts(false),
  };
};

export const useVehicleEfficiencyComparison = (months: number = 6, options?: { startDate?: string; endDate?: string; branch?: string }) => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('vehicle-efficiency-comparison', { months, ...options });

  const cached = cache.get<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    average_efficiency: number;
    total_distance: number;
    total_liters: number;
    total_cost: number;
    fill_count: number;
    efficiency_rank: number;
  }>>(cacheKey);

  const [comparison, setComparison] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const fetchComparison = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<typeof comparison>(cacheKey);
      if (cached !== null && cached !== undefined) {
        setComparison(cached);
        setLoading(false);
        // Background refresh
        setTimeout(() => fetchComparison(false), 100);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const start = options?.startDate ? new Date(options.startDate) : undefined;
      const end = options?.endDate ? new Date(options.endDate) : undefined;
      const result = await fuelService.getVehicleEfficiencyComparison({
        months,
        startDate: start,
        endDate: end,
        branch: options?.branch
      });
      setComparison(result);
      // Cache for 5 minutes
      cache.set(cacheKey, result, 5 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vehicle efficiency comparison'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison();
  }, [months, options?.startDate, options?.endDate, options?.branch]);

  return {
    comparison,
    loading,
    error,
    refetch: () => fetchComparison(false),
  };
};

