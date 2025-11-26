// Custom hooks for fuel logs
import { useState, useEffect } from 'react';
import { fuelService } from '../services/fuelService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import type { Database } from '../types/database';

type FuelRecord = Database['public']['Tables']['fuel_records']['Row'];
type FuelRecordWithUser = FuelRecord & { user?: { full_name: string; email?: string } };

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

