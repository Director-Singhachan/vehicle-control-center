// Custom hook for maintenance history per vehicle
import { useState, useEffect } from 'react';
import { maintenanceService } from '../services/maintenanceService';
import type { Database } from '../types/database';

type MaintenanceHistory = Database['public']['Tables']['maintenance_history']['Row'];

export const useMaintenanceHistory = (vehicleId: string | null) => {
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      setHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await maintenanceService.getHistory({ vehicle_id: vehicleId });
        setHistory(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch maintenance history'));
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [vehicleId]);

  return {
    history,
    loading,
    error,
  };
};


