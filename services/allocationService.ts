/**
 * Allocation Service
 *
 * Manages order_delivery_trip_allocations — the junction table that allows
 * one order to be fulfilled across multiple delivery trips (partial delivery).
 *
 * Key concepts:
 *  - "allocated_quantity"  = quantity committed to a trip (not yet delivered)
 *  - "delivered_quantity"  = quantity confirmed delivered (trip completed)
 *  - "remaining_unallocated" = total_quantity - picked_up - allocated (not cancelled)
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type AllocationRow = Database['public']['Tables']['order_delivery_trip_allocations']['Row'];
type AllocationInsert = Database['public']['Tables']['order_delivery_trip_allocations']['Insert'];

export interface OrderItemRemaining {
  order_item_id: string;
  order_id: string;
  product_id: string;
  total_quantity: number;
  quantity_picked_up_at_store: number;
  quantity_delivered: number;
  fulfillment_method: string;
  allocated_quantity: number;
  fulfilled_via_allocations: number;
  remaining_unallocated: number;
  has_allocations: boolean;
}

export interface OrderRemainingSummary {
  order_id: string;
  store_id: string | null;
  branch: string | null;
  order_status: string | null;
  trip_count: number;
  total_remaining: number;
  total_allocated: number;
  total_delivery_qty: number;
  has_any_allocation: boolean;
}

export interface CreateAllocationInput {
  order_id: string;
  delivery_trip_id: string;
  /** Map of order_item_id → quantity to allocate to this trip */
  items: Array<{
    order_item_id: string;
    allocated_quantity: number;
    notes?: string | null;
  }>;
  sequence_no?: number;
}

export const allocationService = {
  /**
   * Fetch remaining quantities per order item for one order.
   */
  async getRemainingByOrderId(orderId: string): Promise<OrderItemRemaining[]> {
    const { data, error } = await supabase
      .from('order_item_remaining_quantities')
      .select('*')
      .eq('order_id', orderId);

    if (error) throw new Error(`allocationService.getRemainingByOrderId: ${error.message}`);
    return (data ?? []) as OrderItemRemaining[];
  },

  /**
   * Fetch orders that have at least one non-cancelled allocation and still
   * have remaining items to deliver. These are the "partially delivered" orders
   * that belong in the Partial Delivery Queue.
   */
  async getPartiallyDeliveredOrders(filters?: {
    branch?: string;
    branchesIn?: string[];
  }): Promise<OrderRemainingSummary[]> {
    if (filters?.branchesIn !== undefined && filters.branchesIn.length === 0) return [];

    let query = supabase
      .from('order_remaining_summary')
      .select('*')
      .eq('has_any_allocation', true)
      .gt('total_remaining', 0);

    if (filters?.branchesIn !== undefined) {
      query = query.in('branch', filters.branchesIn);
    } else if (filters?.branch && filters.branch !== 'ALL') {
      query = query.eq('branch', filters.branch);
    }

    const { data, error } = await query;
    if (error) throw new Error(`allocationService.getPartiallyDeliveredOrders: ${error.message}`);
    return (data ?? []) as OrderRemainingSummary[];
  },

  /**
   * Get all allocations for a given order, grouped by trip.
   */
  async getAllocationsByOrderId(orderId: string): Promise<AllocationRow[]> {
    const { data, error } = await supabase
      .from('order_delivery_trip_allocations')
      .select('*')
      .eq('order_id', orderId)
      .order('sequence_no', { ascending: true });

    if (error) throw new Error(`allocationService.getAllocationsByOrderId: ${error.message}`);
    return (data ?? []) as AllocationRow[];
  },

  /**
   * Get all allocations for a given trip.
   */
  async getAllocationsByTripId(tripId: string): Promise<AllocationRow[]> {
    const { data, error } = await supabase
      .from('order_delivery_trip_allocations')
      .select('*')
      .eq('delivery_trip_id', tripId)
      .neq('status', 'cancelled');

    if (error) throw new Error(`allocationService.getAllocationsByTripId: ${error.message}`);
    return (data ?? []) as AllocationRow[];
  },

  /**
   * Create allocation rows for a new trip leg. One row per order item included
   * in this leg.
   */
  async createAllocations(input: CreateAllocationInput): Promise<AllocationRow[]> {
    if (input.items.length === 0) {
      throw new Error('allocationService.createAllocations: items array is empty');
    }

    const rows: AllocationInsert[] = input.items.map((item) => ({
      order_id: input.order_id,
      delivery_trip_id: input.delivery_trip_id,
      order_item_id: item.order_item_id,
      allocated_quantity: item.allocated_quantity,
      delivered_quantity: 0,
      status: 'planned' as const,
      sequence_no: input.sequence_no ?? 1,
      notes: item.notes ?? null,
    }));

    const { data, error } = await supabase
      .from('order_delivery_trip_allocations')
      .insert(rows)
      .select();

    if (error) throw new Error(`allocationService.createAllocations: ${error.message}`);
    return (data ?? []) as AllocationRow[];
  },

  /**
   * Mark all allocations for a trip as 'in_delivery' when the trip starts.
   */
  async markTripAllocationsInDelivery(tripId: string): Promise<void> {
    const { error } = await supabase
      .from('order_delivery_trip_allocations')
      .update({ status: 'in_delivery' })
      .eq('delivery_trip_id', tripId)
      .eq('status', 'planned');

    if (error) throw new Error(`allocationService.markTripAllocationsInDelivery: ${error.message}`);
  },

  /**
   * Mark all allocations for a trip as 'delivered' (and copy allocated → delivered)
   * when the trip completes.
   */
  async markTripAllocationsDelivered(tripId: string): Promise<void> {
    const existing = await allocationService.getAllocationsByTripId(tripId);
    if (existing.length === 0) return;

    const updates = existing
      .filter((a) => a.status !== 'delivered' && a.status !== 'cancelled')
      .map((a) => ({
        id: a.id,
        status: 'delivered' as const,
        delivered_quantity: a.allocated_quantity,
      }));

    if (updates.length === 0) return;

    for (const upd of updates) {
      const { error } = await supabase
        .from('order_delivery_trip_allocations')
        .update({ status: upd.status, delivered_quantity: upd.delivered_quantity })
        .eq('id', upd.id);

      if (error) console.error(`[allocationService] Error marking allocation ${upd.id} delivered:`, error);
    }
  },

  /**
   * Cancel all allocations for a trip (when a trip is cancelled/deleted).
   * This frees the allocated quantities back into the remaining pool.
   */
  async cancelTripAllocations(tripId: string): Promise<void> {
    const { error } = await supabase
      .from('order_delivery_trip_allocations')
      .update({ status: 'cancelled' })
      .eq('delivery_trip_id', tripId)
      .neq('status', 'delivered');

    if (error) throw new Error(`allocationService.cancelTripAllocations: ${error.message}`);
  },

  /**
   * Delete all allocations for a trip (hard delete, for non-started trips only).
   */
  async deleteTripAllocations(tripId: string): Promise<void> {
    const { error } = await supabase
      .from('order_delivery_trip_allocations')
      .delete()
      .eq('delivery_trip_id', tripId)
      .not('status', 'in', '("delivered")');

    if (error) throw new Error(`allocationService.deleteTripAllocations: ${error.message}`);
  },

  /**
   * Get next sequence number for an order's allocations (for labeling shipment legs).
   */
  async getNextSequenceNo(orderId: string): Promise<number> {
    const { data, error } = await supabase
      .from('order_delivery_trip_allocations')
      .select('sequence_no')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')
      .order('sequence_no', { ascending: false })
      .limit(1);

    if (error) return 1;
    if (!data || data.length === 0) return 1;
    return (data[0].sequence_no ?? 0) + 1;
  },

  /**
   * Check whether an order has any active (non-cancelled) allocations.
   * Used to determine if an order should be tracked in the Partial Delivery Queue
   * rather than the standard Pending Orders list.
   */
  async hasActiveAllocations(orderId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('order_delivery_trip_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .neq('status', 'cancelled');

    if (error) return false;
    return (count ?? 0) > 0;
  },
};
