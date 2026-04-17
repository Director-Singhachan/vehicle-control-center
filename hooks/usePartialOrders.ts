import { useState, useEffect, useMemo, useCallback } from 'react';
import { allocationService, type OrderRemainingSummary, type OrderItemRemaining } from '../services/allocationService';
import { supabase } from '../lib/supabase';

function filterKey(filters?: { branch?: string; branchesIn?: string[] }): string {
  if (!filters) return 'all';
  if (filters.branchesIn !== undefined) return `in:${[...filters.branchesIn].sort().join('|')}`;
  const b = filters.branch;
  if (b && b !== 'ALL') return `branch:${b}`;
  return 'all';
}

export interface PartialOrder extends OrderRemainingSummary {
  order_number: string;
  customer_name: string | null;
  customer_code: string | null;
  total_amount: number | null;
  order_date: string | null;
  delivery_date: string | null;
  delivery_address: string | null;
  store_name: string | null;
  latest_trip_date: string | null;
}

/**
 * Hook: Partial Delivery Queue (**definition B**).
 * Orders with ≥1 non-cancelled allocation AND remaining unallocated qty > 0
 * (includes planned trips, not only after physical delivery).
 */
export function usePartialOrders(filters?: { branch?: string; branchesIn?: string[] }) {
  const [orders, setOrders] = useState<PartialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const key = useMemo(() => filterKey(filters), [filters]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const summaries = await allocationService.getPartiallyDeliveredOrders(filters);
      if (summaries.length === 0) {
        setOrders([]);
        return;
      }

      const orderIds = summaries.map((s) => s.order_id);

      // Enrich with display fields from orders_with_details
      // View orders_with_details ไม่มีคอลัมน์ store_name (ชื่อร้านใช้ customer_name จาก stores)
      const { data: details, error: detailsError } = await supabase
        .from('orders_with_details')
        .select(
          'id, order_number, customer_name, customer_code, total_amount, order_date, delivery_date, delivery_address, store_address'
        )
        .in('id', orderIds);

      if (detailsError) throw new Error(detailsError.message);

      // Get latest trip date per order from allocations
      const { data: tripDates } = await supabase
        .from('order_delivery_trip_allocations')
        .select('order_id, delivery_trips(planned_date)')
        .in('order_id', orderIds)
        .neq('status', 'cancelled');

      const latestTripDateMap = new Map<string, string>();
      for (const row of tripDates ?? []) {
        const d = (row.delivery_trips as any)?.planned_date;
        if (!d) continue;
        const current = latestTripDateMap.get(row.order_id);
        if (!current || d > current) latestTripDateMap.set(row.order_id, d);
      }

      const detailsMap = new Map<string, any>();
      for (const d of details ?? []) detailsMap.set(d.id, d);

      const enriched: PartialOrder[] = summaries.map((s) => {
        const d = detailsMap.get(s.order_id) ?? {};
        return {
          ...s,
          order_number: d.order_number ?? '',
          customer_name: d.customer_name ?? null,
          customer_code: d.customer_code ?? null,
          total_amount: d.total_amount ?? null,
          order_date: d.order_date ?? null,
          delivery_date: d.delivery_date ?? null,
          delivery_address: d.delivery_address ?? null,
          store_name: d.customer_name ?? d.store_address ?? null,
          latest_trip_date: latestTripDateMap.get(s.order_id) ?? null,
        };
      });

      setOrders(enriched);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

/**
 * Hook: per-item remaining quantities for a single order.
 * Used in OrderShipmentPlanningView to let the user pick how many units
 * to put in the next trip.
 */
export function useOrderItemRemaining(orderId: string | null) {
  const [items, setItems] = useState<OrderItemRemaining[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = useCallback(async () => {
    if (!orderId) { setItems([]); return; }
    try {
      setLoading(true);
      const data = await allocationService.getRemainingByOrderId(orderId);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, loading, error, refetch: fetchItems };
}
