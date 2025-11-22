// Custom hook for tickets
import { useState, useEffect } from 'react';
import { ticketService, type TicketCost } from '../services/ticketService';
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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketService.getAll(options.filters);
      setTickets(data);
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
    refetch: fetchTickets,
  };
};

export const useTicket = (id: number | null) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setTicket(null);
      return;
    }

    const fetchTicket = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ticketService.getById(id);
        setTicket(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch ticket'));
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [id]);

  return {
    ticket,
    loading,
    error,
  };
};

export const useTicketsWithRelations = (filters?: {
  status?: string[];
  vehicle_id?: string;
}) => {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketService.getWithRelations(filters);
      setTickets(data);
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
    loading,
    error,
    refetch: fetchTickets,
  };
};

export const useTicketCosts = (ticketId: number | null) => {
  const [costs, setCosts] = useState<TicketCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setCosts([]);
      return;
    }

    const fetchCosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ticketService.getCosts(ticketId);
        setCosts(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch ticket costs'));
      } finally {
        setLoading(false);
      }
    };

    fetchCosts();
  }, [ticketId]);

  return {
    costs,
    loading,
    error,
    refetch: async () => {
      if (ticketId) {
        const data = await ticketService.getCosts(ticketId);
        setCosts(data);
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

