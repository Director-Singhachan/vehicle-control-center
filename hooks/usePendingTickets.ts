// Hook for pending tickets count (for notifications)
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { ticketService } from '../services/ticketService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';

export const usePendingTickets = () => {
  const { profile, isInspector, isManager, isExecutive } = useAuth();
  const cache = useDataCacheStore();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPendingCount = async (useCache = true) => {
    if (!profile) {
      setCount(0);
      return;
    }

    const cacheKey = createCacheKey('pending-tickets-count', profile.role);
    
    if (useCache) {
      const cached = cache.get<number>(cacheKey);
      if (cached !== null) {
        setCount(cached);
        setLoading(false);
        // Background refresh
        fetchPendingCount(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      let statusFilter: string[] = [];

      // Each role sees different pending tickets
      if (isInspector) {
        statusFilter = ['pending'];
      } else if (isManager) {
        statusFilter = ['approved_inspector'];
      } else if (isExecutive) {
        statusFilter = ['approved_manager'];
      }

      if (statusFilter.length === 0) {
        setCount(0);
        cache.set(cacheKey, 0, 30 * 1000);
        return;
      }

      const tickets = await ticketService.getAll({ status: statusFilter });
      const ticketCount = tickets.length;
      setCount(ticketCount);

      // Cache for 30 seconds
      cache.set(cacheKey, ticketCount, 30 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pending tickets'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCount();

    // Refresh every 30 seconds
    const interval = setInterval(() => fetchPendingCount(false), 30000);

    return () => clearInterval(interval);
  }, [profile?.role, isInspector, isManager, isExecutive]);

  return {
    count,
    loading,
    error,
    refetch: () => fetchPendingCount(false),
  };
};

