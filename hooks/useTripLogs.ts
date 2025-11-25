// Custom hooks for trip logs
import { useState, useEffect } from 'react';
import { tripLogService, type TripLogWithRelations, type CheckoutData, type CheckinData } from '../services/tripLogService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';

export const useTripLogs = (filters?: {
  vehicle_id?: string;
  driver_id?: string;
  start_date?: string;
  end_date?: string;
  status?: 'checked_out' | 'checked_in';
}) => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('trip-logs', filters || {});

  const cached = cache.get<TripLogWithRelations[]>(cacheKey);
  const [trips, setTrips] = useState<TripLogWithRelations[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrips = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<TripLogWithRelations[]>(cacheKey);
      if (cached !== null && cached !== undefined) {
        setTrips(cached);
        setLoading(false);
        // Background refresh
        setTimeout(() => fetchTrips(false), 100);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const data = await tripLogService.getTripHistory(filters);
      setTrips(data);
      // Cache for 1 minute
      cache.set(cacheKey, data, 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch trip logs'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [JSON.stringify(filters)]);

  return {
    trips,
    loading,
    error,
    refetch: () => fetchTrips(false),
  };
};

export const useActiveTrips = (vehicleId?: string) => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('active-trips', vehicleId || 'all');

  const cached = cache.get<TripLogWithRelations[]>(cacheKey);
  const [trips, setTrips] = useState<TripLogWithRelations[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const fetchActiveTrips = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<TripLogWithRelations[]>(cacheKey);
      if (cached !== null && cached !== undefined) {
        setTrips(cached);
        setLoading(false);
        // Background refresh
        setTimeout(() => fetchActiveTrips(false), 100);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const data = await tripLogService.getActiveTripsByVehicle(vehicleId);
      setTrips(data);
      // Cache for 30 seconds (active trips change frequently)
      cache.set(cacheKey, data, 30 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch active trips'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTrips();
    
    // Refresh every 30 seconds for active trips
    const interval = setInterval(() => fetchActiveTrips(false), 30000);
    return () => clearInterval(interval);
  }, [vehicleId]);

  return {
    trips,
    loading,
    error,
    refetch: () => fetchActiveTrips(false),
  };
};

export const useVehicleStatus = (vehicleId: string) => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripLogWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkStatus = async () => {
    if (!vehicleId) {
      setIsAvailable(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const activeTrips = await tripLogService.getActiveTripsByVehicle(vehicleId);
      const hasActiveTrip = activeTrips.length > 0;
      setIsAvailable(!hasActiveTrip);
      setActiveTrip(hasActiveTrip ? activeTrips[0] : null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check vehicle status'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Refresh every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [vehicleId]);

  return {
    isAvailable,
    activeTrip,
    loading,
    error,
    refetch: checkStatus,
  };
};

export const useTripCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkout = async (data: CheckoutData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await tripLogService.createCheckout(data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create checkout';
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    checkout,
    loading,
    error,
  };
};

export const useTripCheckin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkin = async (tripId: string, data: CheckinData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await tripLogService.updateCheckin(tripId, data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update checkin';
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    checkin,
    loading,
    error,
  };
};

export const useOverdueTrips = () => {
  const [trips, setTrips] = useState<TripLogWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOverdueTrips = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tripLogService.getOverdueTrips();
      setTrips(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch overdue trips'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverdueTrips();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchOverdueTrips, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    trips,
    loading,
    error,
    refetch: fetchOverdueTrips,
  };
};

