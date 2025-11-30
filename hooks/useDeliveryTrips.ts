// Hooks for Delivery Trips
import { useState, useEffect } from 'react';
import { deliveryTripService, type DeliveryTripWithRelations } from '../services/deliveryTripService';

export interface UseDeliveryTripsOptions {
  status?: string[];
  vehicle_id?: string;
  driver_id?: string;
  planned_date_from?: string;
  planned_date_to?: string;
  autoFetch?: boolean;
}

export const useDeliveryTrips = (options: UseDeliveryTripsOptions = { autoFetch: true }) => {
  const [trips, setTrips] = useState<DeliveryTripWithRelations[]>([]);
  const [loading, setLoading] = useState(options.autoFetch !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await deliveryTripService.getAll({
        status: options.status,
        vehicle_id: options.vehicle_id,
        driver_id: options.driver_id,
        planned_date_from: options.planned_date_from,
        planned_date_to: options.planned_date_to,
      });
      setTrips(data);
    } catch (err) {
      setError(err as Error);
      console.error('[useDeliveryTrips] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchTrips();
    }
  }, [
    options.status?.join(','),
    options.vehicle_id,
    options.driver_id,
    options.planned_date_from,
    options.planned_date_to,
    options.autoFetch,
  ]);

  return {
    trips,
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

