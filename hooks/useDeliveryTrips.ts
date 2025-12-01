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
      });
      setTrips(data);
      setTotal(total);
    } catch (err) {
      setError(err as Error);
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
    options.page,
    options.pageSize,
  ]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchTrips();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, options.vehicle_id, options.driver_id, options.planned_date_from, options.planned_date_to, options.autoFetch]);

  return {
    trips,
    total,
    loading,
    error,
    refetch: fetchTrips,
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

