// Prefetch Service - Preload data for faster navigation
import { ticketService } from './ticketService';
import { vehicleService } from './vehicleService';
import { reportsService } from './reportsService';
import { usageService } from './usageService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';

export const prefetchService = {
  // Prefetch tickets data
  prefetchTickets: async (filters?: { status?: string[]; vehicle_id?: string }) => {
    const cache = useDataCacheStore.getState();
    const cacheKey = createCacheKey('tickets', filters || {});
    // Only prefetch if not cached
    if (!cache.get(cacheKey)) {
      try {
        const data = await ticketService.getAll(filters);
        cache.set(cacheKey, data, 2 * 60 * 1000); // 2 minutes
      } catch (err) {
        // Silently fail - prefetch shouldn't block UI
        console.debug('Prefetch tickets failed:', err);
      }
    }
  },

  // Prefetch tickets with relations
  prefetchTicketsWithRelations: async (filters?: { status?: string[]; vehicle_id?: string }) => {
    const cache = useDataCacheStore.getState();
    const cacheKey = createCacheKey('tickets-with-relations', filters || {});
    if (!cache.get(cacheKey)) {
      try {
        const data = await ticketService.getWithRelations(filters);
        cache.set(cacheKey, data, 2 * 60 * 1000); // 2 minutes
      } catch (err) {
        console.debug('Prefetch tickets with relations failed:', err);
      }
    }
  },

  // Prefetch vehicles
  prefetchVehicles: async () => {
    const cache = useDataCacheStore.getState();
    const cacheKey = 'vehicles:all';
    if (!cache.get(cacheKey)) {
      try {
        const data = await vehicleService.getAll();
        cache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes (vehicles don't change often)
      } catch (err) {
        console.debug('Prefetch vehicles failed:', err);
      }
    }
  },

  // Prefetch dashboard data
  prefetchDashboard: async () => {
    const cache = useDataCacheStore.getState();
    const cacheKey = 'dashboard:all';
    if (!cache.get(cacheKey)) {
      try {
        await Promise.all([
          vehicleService.getSummary(),
          reportsService.getFinancials(),
          usageService.getDailyUsage(7),
          reportsService.getMaintenanceTrends(6),
          vehicleService.getLocations(),
          vehicleService.getDashboardData(),
        ]);
        // Note: Individual data is cached by their respective services
        // We just trigger the fetch here
      } catch (err) {
        console.debug('Prefetch dashboard failed:', err);
      }
    }
  },
};

