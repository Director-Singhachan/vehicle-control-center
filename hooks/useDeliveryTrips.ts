// Hooks for Delivery Trips
import { useState, useEffect, useCallback, useMemo } from 'react';
import { deliveryTripService, type DeliveryTripWithRelations } from '../services/deliveryTripService';

export interface UseDeliveryTripsOptions {
  status?: string[];
  vehicle_id?: string;
  driver_id?: string;
  planned_date_from?: string;
  planned_date_to?: string;
  autoFetch?: boolean;
  has_item_changes?: boolean;
  page?: number;
  pageSize?: number;
  lite?: boolean;
}

export const useDeliveryTrips = (options: UseDeliveryTripsOptions = { autoFetch: true }) => {
  const [trips, setTrips] = useState<DeliveryTripWithRelations[]>([]);
  const [loading, setLoading] = useState(options.autoFetch !== false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState<number>(0);

  // Memoize status string to avoid recreating on every render
  const statusKey = useMemo(() => {
    return options.status?.sort().join(',') || '';
  }, [options.status]);

  // Use useCallback to memoize fetchTrips function
  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const page = options.page && options.page > 0 ? options.page : 1;
      const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 20;

      const { trips: data, total } = await deliveryTripService.getAllWithPagination({
        status: options.status,
        vehicle_id: options.vehicle_id,
        driver_id: options.driver_id,
        planned_date_from: options.planned_date_from,
        planned_date_to: options.planned_date_to,
        has_item_changes: options.has_item_changes,
        page,
        pageSize,
        lite: options.lite !== false, // Default to true (lite mode) if not specified
      });
      setTrips(data);
      setTotal(total);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('ไม่สามารถโหลดข้อมูลทริปได้');

      // Improve error message for connection errors
      if (error.message.includes('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('ERR_CONNECTION_CLOSED')) {
        // Keep the user-friendly message from service
        setError(error);
      } else {
        // For other errors, provide a generic message
        setError(new Error('ไม่สามารถโหลดข้อมูลทริปได้ กรุณาลองอีกครั้ง'));
      }

      console.error('[useDeliveryTrips] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    statusKey,
    options.vehicle_id,
    options.driver_id,
    options.planned_date_from,
    options.planned_date_to,
    options.has_item_changes,
    options.page,
    options.pageSize,
    options.lite,
  ]);

  // Prefetch next page (basic implementation)
  const prefetch = useCallback(async (page: number) => {
    // Note: This is an optimistic prefetch. 
    // Since we don't have a global cache like React Query, this just warms up the database/network capability
    // or relies on browser HTTP caching if enabled.
    // For a more complete solution, we would need a proper cache store.
    try {
      await deliveryTripService.getAllWithPagination({
        status: options.status,
        vehicle_id: options.vehicle_id,
        driver_id: options.driver_id,
        planned_date_from: options.planned_date_from,
        planned_date_to: options.planned_date_to,
        has_item_changes: options.has_item_changes,
        page,
        pageSize: options.pageSize || 20,
        lite: options.lite !== false,
      });
    } catch (err) {
      // Ignore prefetch errors
      console.log('[useDeliveryTrips] Prefetch error (ignored):', err);
    }
  }, [
    statusKey,
    options.vehicle_id,
    options.driver_id,
    options.planned_date_from,
    options.planned_date_to,
    options.has_item_changes,
    options.pageSize,
    options.lite,
  ]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    fetchTrips();
  }, [fetchTrips, options.autoFetch]);

  // Auto-refresh delivery trips periodically so that
  // the Delivery Trip list reflects updates from check-out/check-in
  // even if the user keeps the page open for a long time.
  useEffect(() => {
    if (options.autoFetch === false) return;

    const interval = setInterval(() => {
      // Use the memoized fetchTrips (no cache layer here)
      fetchTrips();
    }, 30000); // refresh every 30 seconds

    return () => clearInterval(interval);
  }, [fetchTrips, options.autoFetch]);

  return {
    trips,
    total,
    loading,
    error,
    refetch: fetchTrips,
    prefetch,
  };
};

export const useDeliveryTrip = (id: string | null) => {
  const [trip, setTrip] = useState<DeliveryTripWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setTrip(null);
      return;
    }

    const fetchTrip = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await deliveryTripService.getById(id);
        setTrip(data);
      } catch (err) {
        setError(err as Error);
        console.error('[useDeliveryTrip] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [id]);

  return {
    trip,
    loading,
    error,
    refetch: async () => {
      if (id) {
        const data = await deliveryTripService.getById(id);
        setTrip(data);
      }
    },
  };
};

