// Custom hook for tickets - Optimized with caching
import { useState, useEffect } from 'react';
import { ticketService, type TicketCost } from '../services/ticketService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import type { Database } from '../types/database';

type Ticket = Database['public']['Tables']['tickets']['Row'];
type TicketWithRelations = Database['public']['Views']['tickets_with_relations']['Row'];

interface UseTicketsOptions {
  filters?: {
    status?: string[];
    vehicle_id?: string;
    reporter_id?: string;
  };
  autoFetch?: boolean;
}

export const useTickets = (options: UseTicketsOptions = { autoFetch: true }) => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('tickets', options.filters || {});

  const cached = cache.get<Ticket[]>(cacheKey);
  const [tickets, setTickets] = useState<Ticket[]>(cached || []);
  const [loading, setLoading] = useState(!cached && options.autoFetch);
  const [error, setError] = useState<Error | null>(null);

  const fetchTickets = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<Ticket[]>(cacheKey);
      if (cached) {
        setTickets(cached);
        setLoading(false);
        // Background refresh
        fetchTickets(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const data = await ticketService.getAll(options.filters);
      setTickets(data);
      // Cache for 2 minutes
      cache.set(cacheKey, data, 2 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tickets'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoFetch) {
      fetchTickets();
    }
  }, [options.autoFetch, JSON.stringify(options.filters)]);

  return {
    tickets,
    loading,
    error,
    refetch: () => fetchTickets(false),
  };
};

export const useTicket = (id: number | null) => {
  const cache = useDataCacheStore();
  const [ticket, setTicket] = useState<TicketWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setTicket(null);
      return;
    }

    const cacheKey = createCacheKey('ticket-with-relations', id);
    const cached = cache.get<TicketWithRelations>(cacheKey);

    if (cached) {
      setTicket(cached);
      setLoading(false);
    }

    const fetchTicket = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ticketService.getByIdWithRelations(id);
        setTicket(data);
        // Cache for 1 minute
        cache.set(cacheKey, data, 60 * 1000);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch ticket'));
      } finally {
        setLoading(false);
      }
    };

    if (!cached) {
      fetchTicket();
    } else {
      // Background refresh
      fetchTicket();
    }
  }, [id]);

  return {
    ticket,
    loading,
    error,
    refetch: async () => {
      if (!id) return;
      const cacheKey = createCacheKey('ticket-with-relations', id);
      cache.invalidate(cacheKey);
      const data = await ticketService.getByIdWithRelations(id);
      setTicket(data);
      cache.set(cacheKey, data, 60 * 1000);
    },
  };
};

export const useTicketsWithRelations = (filters?: {
  status?: string[];
  vehicle_id?: string;
  limit?: number;
  offset?: number;
  search?: string;
}) => {
  const cache = useDataCacheStore();
  const cacheKey = createCacheKey('tickets-with-relations', filters || {});

  const cached = cache.get<{ data: TicketWithRelations[]; count: number }>(cacheKey);
  const [tickets, setTickets] = useState<TicketWithRelations[]>(cached?.data || []);
  const [totalCount, setTotalCount] = useState<number>(cached?.count || 0);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const fetchTickets = async (useCache = true) => {
    if (useCache) {
      const cached = cache.get<{ data: TicketWithRelations[]; count: number }>(cacheKey);
      if (cached !== null && cached !== undefined) {
        setTickets(cached.data);
        setTotalCount(cached.count);
        setLoading(false);
        setError(null);
        // Background refresh - don't block UI
        setTimeout(() => fetchTickets(false), 100);
        return;
      }
    }

    // Only set loading if we truly have no data
    const currentTickets = tickets.length > 0 ? tickets : cache.get<{ data: TicketWithRelations[]; count: number }>(cacheKey)?.data || [];
    if (currentTickets.length === 0 && !loading) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await ticketService.getWithRelations(filters);
      setTickets(result.data);
      setTotalCount(result.count);
      // Cache for 2 minutes
      cache.set(cacheKey, result, 2 * 60 * 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tickets';
      // Check if it's a connection error
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Connection')) {
        setError(new Error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN'));
      } else {
        setError(new Error(errorMessage));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [JSON.stringify(filters)]);

  return {
    tickets,
    totalCount,
    loading,
    error,
    refetch: () => fetchTickets(false),
  };
};

export const useTicketCosts = (ticketId: number | null) => {
  const cache = useDataCacheStore();
  const [costs, setCosts] = useState<TicketCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setCosts([]);
      return;
    }

    const cacheKey = createCacheKey('ticket-costs', ticketId);
    const cached = cache.get<TicketCost[]>(cacheKey);

    if (cached) {
      setCosts(cached);
      setLoading(false);
    }

    const fetchCosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ticketService.getCosts(ticketId);
        setCosts(data);
        // Cache for 1 minute
        cache.set(cacheKey, data, 60 * 1000);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch ticket costs'));
      } finally {
        setLoading(false);
      }
    };

    if (!cached) {
      fetchCosts();
    } else {
      // Background refresh
      fetchCosts();
    }
  }, [ticketId]);

  return {
    costs,
    loading,
    error,
    refetch: async () => {
      if (ticketId) {
        const cacheKey = createCacheKey('ticket-costs', ticketId);
        cache.invalidate(cacheKey);
        const data = await ticketService.getCosts(ticketId);
        setCosts(data);
        cache.set(cacheKey, data, 60 * 1000);
      }
    },
  };
};

export const useUrgentTicketsCount = () => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCount = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketService.getUrgentCount();
      setCount(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch urgent tickets count'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
  }, []);

  return {
    count,
    loading,
    error,
    refetch: fetchCount,
  };
};

export const useRecentTickets = (limit: number = 10) => {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketService.getRecentTickets(limit);
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch recent tickets'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [limit]);

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets,
  };
};

