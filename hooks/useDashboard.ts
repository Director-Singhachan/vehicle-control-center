// Custom hook for dashboard data
import { useState, useEffect } from 'react';
import { vehicleService, type VehicleSummary, type VehicleForMap } from '../services/vehicleService';
import { reportsService, type Financials, type MaintenanceTrends } from '../services/reportsService';
import { usageService, type DailyUsageData } from '../services/usageService';
import type { Database } from '../types/database';

type VehicleDashboard = Database['public']['Views']['vehicle_dashboard']['Row'];

export interface DashboardData {
  summary: VehicleSummary | null;
  financials: Financials | null;
  usageData: DailyUsageData | null;
  maintenanceTrends: MaintenanceTrends | null;
  vehicles: VehicleForMap[];
  vehicleDashboard: VehicleDashboard[];
}

export const useDashboard = () => {
  const [data, setData] = useState<DashboardData>({
    summary: null,
    financials: null,
    usageData: null,
    maintenanceTrends: null,
    vehicles: [],
    vehicleDashboard: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        summary,
        financials,
        usageData,
        maintenanceTrends,
        vehicles,
        vehicleDashboard,
      ] = await Promise.all([
        vehicleService.getSummary(),
        reportsService.getFinancials(),
        usageService.getDailyUsage(7),
        reportsService.getMaintenanceTrends(6),
        vehicleService.getLocations(),
        vehicleService.getDashboardData(),
      ]);

      setData({
        summary,
        financials,
        usageData,
        maintenanceTrends,
        vehicles,
        vehicleDashboard: vehicleDashboard as VehicleDashboard[],
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData,
  };
};

// Individual hooks for specific dashboard data
export const useVehicleSummary = () => {
  const [summary, setSummary] = useState<VehicleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.getSummary();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vehicle summary'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return {
    summary,
    loading,
    error,
    refetch: fetchSummary,
  };
};

export const useFinancials = () => {
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFinancials = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsService.getFinancials();
      setFinancials(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch financials'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  return {
    financials,
    loading,
    error,
    refetch: fetchFinancials,
  };
};

export const useDailyUsage = (days: number = 7) => {
  const [usageData, setUsageData] = useState<DailyUsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usageService.getDailyUsage(days);
      setUsageData(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch daily usage'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [days]);

  return {
    usageData,
    loading,
    error,
    refetch: fetchUsage,
  };
};

export const useMaintenanceTrends = (months: number = 6) => {
  const [trends, setTrends] = useState<MaintenanceTrends | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsService.getMaintenanceTrends(months);
      setTrends(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch maintenance trends'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [months]);

  return {
    trends,
    loading,
    error,
    refetch: fetchTrends,
  };
};

export const useVehicleLocations = () => {
  const [vehicles, setVehicles] = useState<VehicleForMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.getLocations();
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vehicle locations'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  return {
    vehicles,
    loading,
    error,
    refetch: fetchLocations,
  };
};

