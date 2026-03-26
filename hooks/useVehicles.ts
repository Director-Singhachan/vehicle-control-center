// Custom hook for vehicles - Optimized with caching
import { useState, useEffect } from 'react';
import { vehicleService, type VehicleSummary, type VehicleForMap } from '../services/vehicleService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import type { Database } from '../types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type VehicleWithStatus = Database['public']['Views']['vehicles_with_status']['Row'];

interface UseVehiclesOptions {
  autoFetch?: boolean;
}

export const useVehicles = (options: UseVehiclesOptions = { autoFetch: true }) => {
  const cache = useDataCacheStore();
  const cacheKey = 'vehicles:all';
  
  const cached = cache.get<Vehicle[]>(cacheKey);
  const [vehicles, setVehicles] = useState<Vehicle[]>(cached || []);
  const [loading, setLoading] = useState(!cached && options.autoFetch);
  const [error, setError] = useState<Error | null>(null);

  const fetchVehicles = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<Vehicle[]>(cacheKey);
      if (cached) {
        setVehicles(cached);
        setLoading(false);
        // Background refresh
        fetchVehicles(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.getAll();
      setVehicles(data);
      // Cache for 1 minute (vehicles don't change often)
      cache.set(cacheKey, data, 60 * 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch vehicles';
      // Check if it's a connection error
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Connection') || errorMessage.includes('environment variables')) {
        setError(new Error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN'));
      } else {
        setError(new Error(errorMessage));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoFetch) {
      fetchVehicles();
    }
  }, [options.autoFetch]);

  return {
    vehicles,
    loading,
    error,
    refetch: () => fetchVehicles(false),
  };
};

export const useVehicle = (id: string | null) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setVehicle(null);
      return;
    }

    const fetchVehicle = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await vehicleService.getById(id);
        setVehicle(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch vehicle'));
      } finally {
        setLoading(false);
      }
    };

    fetchVehicle();
  }, [id]);

  return {
    vehicle,
    loading,
    error,
  };
};

export const useVehiclesWithStatus = (options: UseVehiclesOptions = { autoFetch: true }) => {
  const [vehicles, setVehicles] = useState<VehicleWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.getWithStatus();
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vehicles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!options.autoFetch) {
      setVehicles([]);
      setLoading(false);
      setError(null);
      return;
    }
    fetchVehicles();
  }, [options.autoFetch]);

  return {
    vehicles,
    loading,
    error,
    refetch: fetchVehicles,
  };
};

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

export const useVehicleLocations = () => {
  const [locations, setLocations] = useState<VehicleForMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.getLocations();
      setLocations(data);
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
    locations,
    loading,
    error,
    refetch: fetchLocations,
  };
};

