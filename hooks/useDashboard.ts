// Custom hook for dashboard data - Optimized with caching
import { useState, useEffect } from 'react';
import { vehicleService, type VehicleSummary, type VehicleForMap } from '../services/vehicleService';
import { reportsService, type Financials, type MaintenanceTrends } from '../services/reportsService';
import { usageService, type DailyUsageData } from '../services/usageService';
import { ticketService } from '../services/ticketService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import type { Database } from '../types/database';

// Use any type for vehicle_dashboard since it may not exist in all database schemas
type VehicleDashboard = any; // Database['public']['Views']['vehicle_dashboard']['Row'];
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

// Circuit breaker to prevent repeated failed requests
let circuitBreakerOpen = false;
let circuitBreakerFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3; // Open after 3 consecutive failures
const CIRCUIT_BREAKER_RESET_TIME = 60000; // Reset after 60 seconds

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
    // Check circuit breaker
    if (circuitBreakerOpen) {
      console.warn('[useDashboard] Circuit breaker is OPEN - skipping fetch, using cache only');
      const cached = cache.get<DashboardData>(cacheKey);
      if (cached) {
        setData(cached);
      }
      setError(new Error('ระบบไม่สามารถเชื่อมต่อกับ Supabase ได้ชั่วคราว กรุณาลองใหม่ในภายหลัง'));
      setLoading(false);
      return;
    }

    // Check cache first
    if (useCache) {
      const cached = cache.get<DashboardData>(cacheKey);
      if (cached) {
        console.log('[useDashboard] Using cached data');
        setData(cached);
        setLoading(false);
        // Fetch in background to update cache (only if circuit breaker is closed)
        if (!circuitBreakerOpen) {
          setTimeout(() => fetchDashboardData(false, false), 100);
        }
        return;
      }
    }

    console.log('[useDashboard] Fetching dashboard data...');
    // Set loading if forced (refetch) or if we have no data
    if (forceLoading || (!data?.summary && !data?.financials && !data?.usageData && !data?.maintenanceTrends)) {
      setLoading(true);
    }
    setError(null);
    
    // Add timeout to prevent hanging (reduced to 30s - individual queries have 20s timeout)
    // Total timeout should be longer than individual query timeouts to allow for parallel execution
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn('[useDashboard] Fetch timeout after 30s - returning partial data');
        resolve(null);
      }, 30000);
    });

    try {
      console.log('[useDashboard] Starting API calls...');
      const startTime = Date.now();
      
      // Helper function to add timeout to each API call with retry logic
      const withTimeout = <T>(
        promise: Promise<T>, 
        timeoutMs: number, 
        name: string,
        retries = 1
      ): Promise<T | null> => {
        const attempt = async (attemptNumber: number): Promise<T | null> => {
          const startTime = Date.now();
          try {
            const result = await Promise.race([
              promise.then(data => {
                const elapsed = Date.now() - startTime;
                console.log(`[useDashboard] ${name} fetched successfully in ${elapsed}ms${attemptNumber > 0 ? ` (attempt ${attemptNumber + 1})` : ''}`);
                return data;
              }),
              new Promise<T | null>((resolve) => {
                setTimeout(() => {
                  if (attemptNumber < retries) {
                    console.warn(`[useDashboard] ${name} timeout after ${timeoutMs}ms (attempt ${attemptNumber + 1}/${retries + 1}) - retrying...`);
                    resolve(null); // Signal to retry
                  } else {
                    console.warn(`[useDashboard] ${name} timeout after ${timeoutMs}ms - all attempts exhausted`);
                    resolve(null);
                  }
                }, timeoutMs);
              }),
            ]);

            if (result === null && attemptNumber < retries) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
              return attempt(attemptNumber + 1);
            }

            return result;
          } catch (err) {
            const elapsed = Date.now() - startTime;
            console.warn(`[useDashboard] Error fetching ${name} after ${elapsed}ms${attemptNumber > 0 ? ` (attempt ${attemptNumber + 1})` : ''}:`, err);
            
            if (attemptNumber < retries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              return attempt(attemptNumber + 1);
            }
            
            return null;
          }
        };

        return attempt(0);
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

      // PRIORITY-BASED STAGGERED LOADING
      // Load critical data first (Tier 1), then secondary data (Tier 2), then optional data (Tier 3)
      // This prevents connection pool exhaustion and allows UI to show data progressively
      
      console.log('[useDashboard] Starting Tier 1 (Critical) data fetch...');
      
      // Tier 1: Critical data - Load first (most important for UI)
      // Reduced timeout to 10s and no retries for faster failure detection
      const tier1Promise = Promise.all([
        withTimeout(vehicleService.getSummary(), 10000, 'Summary', 0), // No retries for faster failure
        withTimeout(ticketService.getRecentTickets(10), 10000, 'RecentTickets', 0),
        withTimeout(getPendingTicketsCount(), 10000, 'PendingTicketsCount', 0),
      ]);

      const tier1Result = await Promise.race([tier1Promise, timeoutPromise]);
      
      if (tier1Result === null) {
        console.error('[useDashboard] Tier 1 timeout - possible connection issue');
        circuitBreakerFailures++;
        if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitBreakerOpen = true;
          console.error('[useDashboard] Circuit breaker OPENED after', circuitBreakerFailures, 'failures');
          // Reset circuit breaker after timeout
          setTimeout(() => {
            circuitBreakerOpen = false;
            circuitBreakerFailures = 0;
            console.log('[useDashboard] Circuit breaker RESET');
          }, CIRCUIT_BREAKER_RESET_TIME);
        }
      } else {
        // Reset failure count on success
        circuitBreakerFailures = 0;
        const [summary, recentTickets, pendingTicketsCount] = tier1Result;
        // Update UI immediately with Tier 1 data
        setData(prev => ({
          ...prev,
          summary: summary || prev.summary,
          recentTickets: (recentTickets || []) as TicketWithRelations[],
          pendingTicketsCount: pendingTicketsCount || 0,
        }));
        console.log('[useDashboard] Tier 1 data loaded, updating UI...');
      }

      // Only continue if Tier 1 succeeded and circuit breaker is closed
      if (circuitBreakerOpen) {
        setLoading(false);
        setError(new Error('ระบบไม่สามารถเชื่อมต่อกับ Supabase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'));
        return;
      }

      // Wait a bit before loading Tier 2 to avoid overwhelming the connection pool
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[useDashboard] Starting Tier 2 (Secondary) data fetch...');
      
      // Tier 2: Secondary data - Load after Tier 1
      // Reduced timeout to 10s, no retries
      const tier2Promise = Promise.all([
        withTimeout(reportsService.getFinancials(), 10000, 'Financials', 0),
        withTimeout(usageService.getDailyUsage(7), 10000, 'Usage', 0),
        withTimeout(vehicleService.getLocations(), 10000, 'Locations', 0),
      ]);

      const tier2Result = await Promise.race([
        tier2Promise,
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('[useDashboard] Tier 2 timeout after 15s');
            resolve(null);
          }, 15000);
        }),
      ]);

      if (tier2Result !== null) {
        const [financials, usageData, vehicles] = tier2Result;
        setData(prev => ({
          ...prev,
          financials: financials || prev.financials,
          usageData: usageData || prev.usageData,
          vehicles: vehicles || prev.vehicles,
        }));
        console.log('[useDashboard] Tier 2 data loaded');
      }

      // Wait a bit before loading Tier 3
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[useDashboard] Starting Tier 3 (Optional) data fetch...');
      
      // Tier 3: Optional data - Load last (can be slow, less critical)
      // Reduced timeout to 10s, no retries
      const tier3Promise = Promise.all([
        withTimeout(reportsService.getMaintenanceTrends(6), 10000, 'Trends', 0),
        withTimeout(vehicleService.getDashboardData(), 10000, 'Dashboard', 0),
      ]);

      const tier3Result = await Promise.race([
        tier3Promise,
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('[useDashboard] Tier 3 timeout after 15s');
            resolve(null);
          }, 15000);
        }),
      ]);

      if (tier3Result !== null) {
        const [maintenanceTrends, vehicleDashboard] = tier3Result;
        setData(prev => ({
          ...prev,
          maintenanceTrends: maintenanceTrends || prev.maintenanceTrends,
          vehicleDashboard: (vehicleDashboard || []) as VehicleDashboard[],
        }));
        console.log('[useDashboard] Tier 3 data loaded');
      }

      const elapsed = Date.now() - startTime;
      console.log(`[useDashboard] All tiers completed in ${elapsed}ms`);

      // Collect all results from all tiers (data may have been set progressively via setData)
      const summary = tier1Result?.[0] || null;
      const recentTickets = tier1Result?.[1] || null;
      const pendingTicketsCount = tier1Result?.[2] || 0;
      const financials = tier2Result?.[0] || null;
      const usageData = tier2Result?.[1] || null;
      const vehicles = tier2Result?.[2] || null;
      const maintenanceTrends = tier3Result?.[0] || null;
      const vehicleDashboard = tier3Result?.[1] || null;

      // Check if we got any data at all
      const hasAnyData = summary || recentTickets?.length || financials || usageData || vehicles?.length || maintenanceTrends;
      
      if (!hasAnyData) {
        console.error('[useDashboard] All API calls timed out - possible Supabase connection issue');
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
        hasAnyData,
      });

      // Final update to ensure all data is set (even if some tiers failed)
      setData(newData);
      // Set loading to false immediately after setting data (even if partial)
      setLoading(false);
      console.log('[useDashboard] Data set, loading set to false');
      
      // Cache for 2 minutes (only if we have some data)
      if (hasAnyData) {
        cache.set(cacheKey, newData, 2 * 60 * 1000);
      }
    } catch (err) {
      console.error('[useDashboard] Fatal error:', err);
      circuitBreakerFailures++;
      if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreakerOpen = true;
        console.error('[useDashboard] Circuit breaker OPENED after', circuitBreakerFailures, 'failures');
        setTimeout(() => {
          circuitBreakerOpen = false;
          circuitBreakerFailures = 0;
          console.log('[useDashboard] Circuit breaker RESET');
        }, CIRCUIT_BREAKER_RESET_TIME);
      }
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
