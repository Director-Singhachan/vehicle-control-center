// Custom hook for dashboard data - Optimized with caching
import { useState, useEffect } from 'react';
import { vehicleService, type VehicleSummary, type VehicleForMap } from '../services/vehicleService';
import { reportsService, type Financials, type MaintenanceTrends } from '../services/reportsService';
import { usageService, type DailyUsageData } from '../services/usageService';
import { ticketService } from '../services/ticketService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import type { Database } from '../types/database';

type VehicleDashboard = Database['public']['Views']['vehicle_dashboard']['Row'];
type TicketWithRelations = Database['public']['Views']['tickets_with_relations']['Row'];

export interface DashboardData {
  summary: VehicleSummary | null;
  financials: Financials | null;
  usageData: DailyUsageData | null;
  maintenanceTrends: MaintenanceTrends | null;
  vehicles: VehicleForMap[];
  vehicleDashboard: VehicleDashboard[];
  recentTickets: TicketWithRelations[];
  pendingTicketsCount: number;
}

export const useDashboard = () => {
  const cache = useDataCacheStore();
  const cacheKey = 'dashboard:all';

  // Try to get cached data first
  const cachedData = cache.get<DashboardData>(cacheKey);

  const [data, setData] = useState<DashboardData>(cachedData || {
    summary: null,
    financials: null,
    usageData: null,
    maintenanceTrends: null,
    vehicles: [],
    vehicleDashboard: [],
    recentTickets: [],
    pendingTicketsCount: 0,
  });
  // Always start with loading: false - show UI immediately
  // Data will appear when it's ready (prevents infinite loading)
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboardData = async (useCache = true, forceLoading = false) => {
    // Check cache first
    if (useCache) {
      const cached = cache.get<DashboardData>(cacheKey);
      if (cached) {
        console.log('[useDashboard] Using cached data');
        setData(cached);
        setLoading(false);
        // Fetch in background to update cache
        setTimeout(() => fetchDashboardData(false, false), 100);
        return;
      }
    }

    console.log('[useDashboard] Fetching dashboard data...');
    // Set loading if forced (refetch) or if we have no data
    if (forceLoading || (!data?.summary && !data?.financials && !data?.usageData && !data?.maintenanceTrends)) {
      setLoading(true);
    }
    setError(null);
    
    // Add timeout to prevent hanging (increased to 60s since Gateway shows requests succeed but are slow)
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn('[useDashboard] Fetch timeout after 60s - returning partial data');
        resolve(null);
      }, 60000);
    });

    try {
      console.log('[useDashboard] Starting API calls...');
      const startTime = Date.now();
      
      // Helper function to add timeout to each API call
      // Increased timeout to 30 seconds since Gateway logs show requests are successful but slow
      const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T | null> => {
        const startTime = Date.now();
        return Promise.race([
          promise.then(data => {
            const elapsed = Date.now() - startTime;
            console.log(`[useDashboard] ${name} fetched successfully in ${elapsed}ms`);
            return data;
          }).catch(err => {
            const elapsed = Date.now() - startTime;
            console.warn(`[useDashboard] Error fetching ${name} after ${elapsed}ms:`, err);
            return null;
          }),
          new Promise<T | null>((resolve) => {
            setTimeout(() => {
              console.warn(`[useDashboard] ${name} timeout after ${timeoutMs}ms`);
              resolve(null);
            }, timeoutMs);
          }),
        ]);
      };

      // Helper to get pending tickets count
      const getPendingTicketsCount = async (): Promise<number> => {
        try {
          const tickets = await ticketService.getAll({ status: ['pending'] });
          return tickets.length;
        } catch (err) {
          console.warn('[useDashboard] Error fetching pending tickets count:', err);
          return 0;
        }
      };

      // Increased timeout to 30 seconds since Gateway logs show requests succeed but are slow
      // Some queries (especially with joins/views) may take longer
      const fetchPromise = Promise.all([
        withTimeout(vehicleService.getSummary(), 30000, 'Summary'),
        withTimeout(reportsService.getFinancials(), 30000, 'Financials'),
        withTimeout(usageService.getDailyUsage(7), 30000, 'Usage'),
        withTimeout(reportsService.getMaintenanceTrends(6), 30000, 'Trends'),
        withTimeout(vehicleService.getLocations(), 30000, 'Locations'),
        withTimeout(vehicleService.getDashboardData(), 30000, 'Dashboard'),
        withTimeout(ticketService.getRecentTickets(10), 30000, 'RecentTickets'),
        withTimeout(getPendingTicketsCount(), 30000, 'PendingTicketsCount'),
      ]);

      console.log('[useDashboard] Waiting for Promise.race...');
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;
      console.log(`[useDashboard] Promise.race completed in ${elapsed}ms`);

      // If timeout, use empty data and set error
      if (result === null) {
        console.error('[useDashboard] All API calls timed out - possible Supabase connection issue');
        const timeoutError = new Error('ไม่สามารถเชื่อมต่อกับ Supabase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN');
        setError(timeoutError);
        setData({
          summary: null,
          financials: null,
          usageData: null,
          maintenanceTrends: null,
          vehicles: [],
          vehicleDashboard: [],
          recentTickets: [],
          pendingTicketsCount: 0,
        });
        setLoading(false);
        console.log('[useDashboard] Timeout - loading set to false');
        return;
      }

      const [
        summary,
        financials,
        usageData,
        maintenanceTrends,
        vehicles,
        vehicleDashboard,
        recentTickets,
        pendingTicketsCount,
      ] = result;

      // Check if all API calls failed (all are null/empty)
      const allFailed = !summary && !financials && !usageData && !maintenanceTrends && 
                       (!vehicles || vehicles.length === 0) && 
                       (!vehicleDashboard || vehicleDashboard.length === 0) &&
                       (!recentTickets || recentTickets.length === 0);

      if (allFailed) {
        console.error('[useDashboard] All API calls failed or timed out - possible Supabase connection issue');
        const timeoutError = new Error('ไม่สามารถเชื่อมต่อกับ Supabase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN');
        setError(timeoutError);
      } else {
        // Clear error if we have some data
        setError(null);
      }

      const newData = {
        summary,
        financials,
        usageData,
        maintenanceTrends,
        vehicles,
        vehicleDashboard: vehicleDashboard as VehicleDashboard[],
        recentTickets: (recentTickets || []) as TicketWithRelations[],
        pendingTicketsCount: pendingTicketsCount || 0,
      };

      console.log('[useDashboard] Data fetched:', {
        hasSummary: !!summary,
        hasFinancials: !!financials,
        hasUsageData: !!usageData,
        hasTrends: !!maintenanceTrends,
        vehiclesCount: vehicles?.length || 0,
        ticketsCount: recentTickets?.length || 0,
        pendingTicketsCount: pendingTicketsCount || 0,
        allFailed,
      });

      setData(newData);
      // Set loading to false immediately after setting data (even if partial)
      setLoading(false);
      console.log('[useDashboard] Data set, loading set to false');
      
      // Cache for 2 minutes (only if we have some data)
      if (!allFailed) {
        cache.set(cacheKey, newData, 2 * 60 * 1000);
      }
    } catch (err) {
      console.error('[useDashboard] Fatal error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
      // Set empty data on error to prevent infinite loading
      setData({
        summary: null,
        financials: null,
        usageData: null,
        maintenanceTrends: null,
        vehicles: [],
        vehicleDashboard: [],
        recentTickets: [],
        pendingTicketsCount: 0,
      });
      setLoading(false);
      console.log('[useDashboard] Error - loading set to false');
    } finally {
      // Ensure loading is always false after fetch completes
      console.log('[useDashboard] Fetch completed, loading:', false);
    }
  };

  useEffect(() => {
    // Always fetch on mount (will use cache if available)
    fetchDashboardData();
  }, []); // Empty deps - only run once on mount

  return {
    data,
    loading,
    error,
    refetch: async () => {
      // Invalidate cache first to force fresh fetch
      cache.invalidate(cacheKey);
      // Also invalidate related cache entries
      cache.invalidate([
        createCacheKey('tickets-with-relations', {}),
        createCacheKey('tickets', {}),
      ]);
      // Force fetch without cache and show loading state
      await fetchDashboardData(false, true);
    },
  };
};

// Individual hooks for specific dashboard data


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



