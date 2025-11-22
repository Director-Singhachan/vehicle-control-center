// Custom hook for vehicles
import { useState, useEffect } from 'react';
import { vehicleService, type VehicleSummary, type VehicleForMap } from '../services/vehicleService';
import type { Database } from '../types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type VehicleWithStatus = Database['public']['Views']['vehicles_with_status']['Row'];

interface UseVehiclesOptions {
  autoFetch?: boolean;
}

export const useVehicles = (options: UseVehiclesOptions = { autoFetch: true }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.getAll();
      setVehicles(data);
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
    refetch: fetchVehicles,
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

export const useVehiclesWithStatus = () => {
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
    fetchVehicles();
  }, []);

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

