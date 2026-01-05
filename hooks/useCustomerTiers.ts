import { useState, useEffect } from 'react';
import { customerTierService, productTierPriceService, pricingReportService } from '../services/customerTierService';
import type { Database } from '../types/database';

type CustomerTier = Database['public']['Tables']['customer_tiers']['Row'];

// ========================================
// Customer Tiers Hooks
// ========================================

export function useCustomerTiers() {
  const [tiers, setTiers] = useState<CustomerTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const data = await customerTierService.getAll();
      setTiers(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  return { tiers, loading, error, refetch: fetchTiers };
}

export function useCustomerTier(id: string | null) {
  const [tier, setTier] = useState<CustomerTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setTier(null);
      setLoading(false);
      return;
    }

    const fetchTier = async () => {
      try {
        setLoading(true);
        const data = await customerTierService.getById(id);
        setTier(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchTier();
  }, [id]);

  return { tier, loading, error };
}

// ========================================
// Product Tier Prices Hooks
// ========================================

export function useProductTierPrices(productId: string | null) {
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrices = async () => {
    if (!productId) {
      setPrices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await productTierPriceService.getByProduct(productId);
      setPrices(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, [productId]);

  return { prices, loading, error, refetch: fetchPrices };
}

export function useTierPrices(tierId: string | null) {
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrices = async () => {
    if (!tierId) {
      setPrices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await productTierPriceService.getByTier(tierId);
      setPrices(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, [tierId]);

  return { prices, loading, error, refetch: fetchPrices };
}

// ========================================
// Pricing Reports Hooks
// ========================================

export function useProductPricesSummary() {
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await pricingReportService.getProductPricesSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return { summary, loading, error, refetch: fetchSummary };
}

export function usePriceHistory(productId?: string, tierId?: string) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await productTierPriceService.getPriceHistory(productId, tierId);
      setHistory(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [productId, tierId]);

  return { history, loading, error, refetch: fetchHistory };
}

// ========================================
// Customer Count by Tier Hook
// ========================================

export function useCustomerCountByTier() {
  const [counts, setCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const data = await customerTierService.getCustomerCountByTier();
      setCounts(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  return { counts, loading, error, refetch: fetchCounts };
}

