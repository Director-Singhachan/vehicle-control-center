import { useState, useEffect } from 'react';
import { ordersService, orderItemsService, orderStatsService } from '../services/ordersService';

export function useOrders(filters?: {
  status?: string;
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await ordersService.getAll(filters);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filters?.status, filters?.storeId, filters?.dateFrom, filters?.dateTo, filters?.branch]);

  return { orders, loading, error, refetch: fetchOrders };
}

export function usePendingOrders(filters?: {
  branch?: string;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await ordersService.getPendingOrders(filters);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filters?.branch]); // Added filters?.branch to dependency array

  return { orders, loading, error, refetch: fetchOrders };
}

export function useOrder(id: string | null) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await ordersService.getById(id);
        setOrder(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  return { order, loading, error };
}

export function useOrderItems(orderId: string | null) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = async () => {
    if (!orderId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await orderItemsService.getByOrderId(orderId);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [orderId]);

  return { items, loading, error, refetch: fetchItems };
}

export function useOrderStats(dateFrom?: string, dateTo?: string) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await orderStatsService.getStats(dateFrom, dateTo);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateFrom, dateTo]);

  return { stats, loading, error, refetch: fetchStats };
}

