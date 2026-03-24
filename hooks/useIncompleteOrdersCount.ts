import { useState, useEffect, useCallback } from 'react';
import { incompleteOrdersService } from '../services/incompleteOrdersService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import { useAuth } from './useAuth';

export const useIncompleteOrdersCount = () => {
  const { profile } = useAuth();
  const cache = useDataCacheStore();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCount = useCallback(async (useCache = true) => {
    if (!profile) {
      setCount(0);
      return;
    }

    const cacheKey = createCacheKey('incomplete-orders-count', profile.id || 'anonymous');

    if (useCache) {
      const cached = cache.get<number>(cacheKey);
      if (cached !== null) {
        setCount(cached);
        // Background refresh
        fetchCount(false);
        return;
      }
    }

    setLoading(true);
    try {
      const orders = await incompleteOrdersService.getAll();
      const newCount = orders.length;
      setCount(newCount);
      cache.set(cacheKey, newCount, 30 * 1000); // Cache for 30s
      setError(null);
    } catch (err: any) {
      console.error('Error fetching incomplete orders count:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [profile, cache]);

  useEffect(() => {
    fetchCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchCount(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchCount]);

  return { 
    count, 
    loading, 
    error,
    refetch: () => fetchCount(false)
  };
};
