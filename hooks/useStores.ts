// Hooks for Stores
import { useState, useEffect } from 'react';
import { storeService, type Store, type StoreFilters } from '../services/storeService';

interface UseStoresOptions {
  enabled?: boolean;
}

export const useStores = (filters?: StoreFilters, options: UseStoresOptions = {}) => {
  const enabled = options.enabled ?? true;
  const [stores, setStores] = useState<Store[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStores([]);
      setTotalCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchStores = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await storeService.getAll(filters);
        setStores(result.data);
        setTotalCount(result.totalCount);
      } catch (err) {
        setError(err as Error);
        console.error('[useStores] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, [enabled, filters?.search, filters?.is_active, filters?.branch, filters?.limit, filters?.offset]);

  return {
    stores,
    totalCount,
    loading,
    error,
    refetch: async () => {
      if (!enabled) {
        setStores([]);
        setTotalCount(0);
        setError(null);
        setLoading(false);
        return;
      }
      const result = await storeService.getAll(filters);
      setStores(result.data);
      setTotalCount(result.totalCount);
    },
  };
};

