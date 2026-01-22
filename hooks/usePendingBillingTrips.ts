// Hook for pending billing trips count (for sales notifications)
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { deliveryTripService } from '../services/deliveryTripService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';

export interface PendingBillingTrip {
  id: string;
  trip_number: string | null;
  sequence_order: number | null;
  planned_date: string;
  vehicle?: {
    plate: string;
  };
  stores?: Array<{
    id: string;
    store_id: string;
    invoice_status: string | null;
    store?: {
      customer_name: string;
      customer_code: string;
    };
  }>;
}

export const usePendingBillingTrips = () => {
  const { profile, isSales } = useAuth();
  const cache = useDataCacheStore();
  const [count, setCount] = useState(0);
  const [trips, setTrips] = useState<PendingBillingTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPendingTrips = async (useCache = true) => {
    if (!profile || !isSales) {
      setCount(0);
      setTrips([]);
      return;
    }

    const cacheKey = createCacheKey('pending-billing-trips-count', 'sales');
    
    if (useCache) {
      const cached = cache.get<{ count: number; trips: PendingBillingTrip[] }>(cacheKey);
      if (cached !== null) {
        setCount(cached.count);
        setTrips(cached.trips);
        setLoading(false);
        // Background refresh
        fetchPendingTrips(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch trips from today onwards (trips that are ready for billing)
      const today = new Date().toISOString().split('T')[0];
      const allTrips = await deliveryTripService.getAll({
        planned_date_from: today,
        lite: false, // Need full store details to check invoice_status
      });

      // Filter trips that have stores with pending billing
      const pendingTrips = allTrips.filter((trip: any) => {
        if (!trip.stores || trip.stores.length === 0) return false;
        
        // Check if at least one store has not been invoiced
        return trip.stores.some((store: any) => {
          return store.invoice_status !== 'issued';
        });
      });

      // Sort by planned_date (earliest first)
      pendingTrips.sort((a: any, b: any) => {
        const dateA = new Date(a.planned_date).getTime();
        const dateB = new Date(b.planned_date).getTime();
        return dateA - dateB;
      });

      // Limit to 10 most recent trips for notification
      const limitedTrips = pendingTrips.slice(0, 10);
      
      setCount(pendingTrips.length);
      setTrips(limitedTrips);

      // Cache for 30 seconds
      cache.set(cacheKey, { count: pendingTrips.length, trips: limitedTrips }, 30 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pending billing trips'));
      setCount(0);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTrips();

    // Refresh every 30 seconds
    const interval = setInterval(() => fetchPendingTrips(false), 30000);

    return () => clearInterval(interval);
  }, [profile?.role, isSales]);

  return {
    count,
    trips,
    loading,
    error,
    refetch: () => fetchPendingTrips(false),
  };
};
