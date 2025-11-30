// Hooks for Stores
import { useState, useEffect } from 'react';
import { storeService, type Store, type StoreFilters } from '../services/storeService';

export const useStores = (filters?: StoreFilters) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await storeService.getAll(filters);
        setStores(data);
      } catch (err) {
        setError(err as Error);
        console.error('[useStores] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, [filters?.search, filters?.is_active]);

  return {
    stores,
    loading,
    error,
    refetch: async () => {
      const data = await storeService.getAll(filters);
      setStores(data);
    },
  };
};

