// Hook for AI vehicle recommendations
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  vehicleRecommendationService,
  type RecommendationInput,
  type VehicleRecommendation,
} from '../services/vehicleRecommendationService';

interface UseVehicleRecommendationOptions {
  /** Auto-fetch when input changes (default: true) */
  autoFetch?: boolean;
  /** Debounce delay in ms (default: 800) */
  debounceMs?: number;
  /** Max results (default: 5) */
  limit?: number;
}

interface UseVehicleRecommendationReturn {
  recommendations: VehicleRecommendation[];
  loading: boolean;
  error: Error | null;
  /** Manually trigger a fetch */
  fetch: () => Promise<void>;
  /** Clear recommendations */
  clear: () => void;
  /** Whether recommendations have been fetched at least once */
  hasFetched: boolean;
}

export function useVehicleRecommendation(
  input: RecommendationInput | null,
  options: UseVehicleRecommendationOptions = {}
): UseVehicleRecommendationReturn {
  const { autoFetch = true, debounceMs = 800, limit = 5 } = options;

  const [recommendations, setRecommendations] = useState<VehicleRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!input || input.items.length === 0 || input.store_ids.length === 0) {
      setRecommendations([]);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const results = await vehicleRecommendationService.getRecommendations(input, limit);
      if (!abortRef.current) {
        setRecommendations(results);
        setHasFetched(true);
      }
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to get recommendations'));
        setRecommendations([]);
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [input, limit]);

  // Auto-fetch with debounce when input changes
  useEffect(() => {
    if (!autoFetch) return;

    if (!input || input.items.length === 0 || input.store_ids.length === 0) {
      setRecommendations([]);
      setLoading(false);
      return;
    }

    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setLoading(true);

    timerRef.current = setTimeout(() => {
      fetchRecommendations();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      abortRef.current = true;
    };
  }, [
    // Serialize input for dependency comparison
    input?.planned_date,
    input?.branch,
    input?.store_ids.join(','),
    input?.items.map((i) => `${i.product_id}:${i.quantity}`).join(','),
    autoFetch,
    debounceMs,
  ]);

  const clear = useCallback(() => {
    abortRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setRecommendations([]);
    setLoading(false);
    setError(null);
    setHasFetched(false);
  }, []);

  return {
    recommendations,
    loading,
    error,
    fetch: fetchRecommendations,
    clear,
    hasFetched,
  };
}
