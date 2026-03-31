// Trip history and aggregates - getAggregatedProducts, getItemChangeHistory, getDeliveryTripEditHistory, getStaffItemDistribution, getProductDistributionByTrip
import { supabase } from '../../lib/supabase';
import { tripCrudService } from './tripCrudService';
import type { DeliveryTripItemChangeWithDetails } from './types';
import type { TripEditHistory } from '../tripLogService';

export const tripHistoryAggregatesService = {
  getAggregatedProducts: async (tripId: string): Promise<Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    total_quantity: number;
    total_picked_up_at_store: number;
    stores: Array<{
      store_id: string;
      customer_code: string;
      customer_name: string;
      quantity: number;
      quantity_picked_up_at_store: number;
    }>;
  }>> => {
    const trip = await tripCrudService.getById(tripId);
    if (!trip || !trip.stores) return [];

    const productMap = new Map<string, {
      product_id: string;
      product_code: string;
      product_name: string;
      category: string;
      unit: string;
      total_quantity: number;
      total_picked_up_at_store: number;
      stores: Array<{
        store_id: string;
        customer_code: string;
        customer_name: string;
        quantity: number;
        quantity_picked_up_at_store: number;
      }>;
    }>();

    for (const store of trip.stores) {
      if (!store.items) continue;
      for (const item of store.items) {
        if (!item.product) continue;
        const productId = item.product.id;
        const pickedUp = Number((item as any).quantity_picked_up_at_store ?? 0);
        const toDeliver = Number((item as any).quantity_to_deliver ?? (Number(item.quantity) - pickedUp));
        const lineUnit =
          ((item as { unit?: string | null }).unit != null &&
          String((item as { unit?: string | null }).unit).trim() !== ''
            ? String((item as { unit?: string | null }).unit).trim()
            : '') || item.product.unit || '';
        const existing = productMap.get(productId);
        if (existing) {
          existing.total_quantity += toDeliver;
          existing.total_picked_up_at_store += pickedUp;
          if (!existing.unit && lineUnit) {
            existing.unit = lineUnit;
          }
          existing.stores.push({
            store_id: store.store_id,
            customer_code: store.store?.customer_code || '',
            customer_name: store.store?.customer_name || '',
            quantity: toDeliver,
            quantity_picked_up_at_store: pickedUp,
          });
        } else {
          productMap.set(productId, {
            product_id: productId,
            product_code: item.product.product_code,
            product_name: item.product.product_name,
            category: item.product.category,
            unit: lineUnit || item.product.unit,
            total_quantity: toDeliver,
            total_picked_up_at_store: pickedUp,
            stores: [{
              store_id: store.store_id,
              customer_code: store.store?.customer_code || '',
              customer_name: store.store?.customer_name || '',
              quantity: toDeliver,
              quantity_picked_up_at_store: pickedUp,
            }],
          });
        }
      }
    }
    return Array.from(productMap.values());
  },

  getItemChangeHistory: async (tripId: string): Promise<DeliveryTripItemChangeWithDetails[]> => {
    const { data: changes, error } = await supabase
      .from('delivery_trip_item_changes')
      .select('*')
      .eq('delivery_trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[deliveryTripService] Error fetching item change history:', error);
      throw error;
    }
    if (!changes || changes.length === 0) return [];

    const productIds = [...new Set(changes.map(c => c.product_id).filter(Boolean))] as string[];
    const userIds = [...new Set(changes.map(c => c.created_by).filter(Boolean))] as string[];

    // รวม store_id ทั้งหมด: ใช้ store_id โดยตรง (ถ้ามี) หรือ resolve จาก delivery_trip_store_id
    const directStoreIds = [...new Set(changes.map(c => (c as any).store_id).filter(Boolean))] as string[];
    const tripStoreIds = [...new Set(
      changes.filter(c => !(c as any).store_id && c.delivery_trip_store_id).map(c => c.delivery_trip_store_id).filter(Boolean)
    )] as string[];

    const [productsResult, usersResult] = await Promise.all([
      productIds.length ? supabase.from('products').select('id, product_code, product_name, unit').in('id', productIds) : Promise.resolve({ data: null, error: null } as any),
      userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: null, error: null } as any),
    ]);

    // Fetch tripStores สำหรับ records ที่ไม่มี store_id โดยตรง (fallback)
    const tripStoreResult = tripStoreIds.length
      ? await supabase.from('delivery_trip_stores').select('id, store_id').in('id', tripStoreIds)
      : { data: [] as any[] };
    const tripStores = (tripStoreResult as any).data || [];
    const fallbackStoreIds = [...new Set(tripStores.map((ts: any) => ts.store_id).filter(Boolean))] as string[];

    // รวม store_ids ทั้งหมดที่ต้อง fetch
    const allStoreIds = [...new Set([...directStoreIds, ...fallbackStoreIds])];
    const { data: storesData } = allStoreIds.length
      ? await supabase.from('stores').select('id, customer_code, customer_name').in('id', allStoreIds)
      : { data: [] as any[] };

    const products = (productsResult as any).data || [];
    const users = (usersResult as any).data || [];
    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const storeMap = new Map((storesData || []).map((s: any) => [s.id, s]));
    const tripStoreIdToStoreIdMap = new Map(tripStores.map((ts: any) => [ts.id, ts.store_id]));
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    return changes.map(change => {
      let store = null;
      const directStoreId = (change as any).store_id;
      if (directStoreId) {
        // ใช้ store_id โดยตรง (primary path — ทำงานได้แม้ delivery_trip_stores ถูกลบ)
        store = storeMap.get(directStoreId) || null;
      } else if (change.delivery_trip_store_id) {
        // fallback: resolve ผ่าน delivery_trip_stores (สำหรับ records เก่าที่ยังไม่มี store_id)
        const storeId = tripStoreIdToStoreIdMap.get(change.delivery_trip_store_id);
        if (storeId) {
          store = storeMap.get(storeId) || null;
        }
      }
      return {
        ...change,
        product: change.product_id ? productMap.get(change.product_id) || null : null,
        store,
        user: change.created_by ? userMap.get(change.created_by) || null : null,
      };
    }) as DeliveryTripItemChangeWithDetails[];
  },



  getDeliveryTripEditHistory: async (tripId: string): Promise<TripEditHistory[]> => {
    const { data, error } = await supabase
      .from('trip_edit_history')
      .select('*, editor:profiles!edited_by(full_name, email)')
      .eq('delivery_trip_id', tripId)
      .order('edited_at', { ascending: false });
    if (error) {
      console.error('[deliveryTripService] Error fetching delivery trip edit history:', error);
      throw error;
    }
    return (data || []) as TripEditHistory[];
  },

  getStaffItemDistribution: async (tripId: string): Promise<Array<{
    crew_id: string;
    staff_id: string;
    staff_code: string | null;
    staff_name: string;
    staff_phone: string | null;
    staff_role: 'driver' | 'helper';
    total_items_to_carry: number;
    total_items_per_staff: number;
    total_staff_count: number;
    distinct_product_count: number;
    distinct_store_count: number;
  }>> => {
    const { data, error } = await supabase
      .from('staff_item_distribution_summary')
      .select('*')
      .eq('delivery_trip_id', tripId)
      .order('staff_name');
    if (error) {
      console.error('[deliveryTripService] Error fetching staff item distribution:', error);
      throw error;
    }
    return (data || []).map((item: any) => ({
      crew_id: item.crew_id,
      staff_id: item.staff_id,
      staff_code: item.staff_code,
      staff_name: item.staff_name,
      staff_phone: item.staff_phone,
      staff_role: item.staff_role,
      total_items_to_carry: parseFloat(item.total_items_to_carry || '0'),
      total_items_per_staff: parseFloat(item.total_items_per_staff || '0'),
      total_staff_count: parseFloat(item.total_staff_count || '0'),
      distinct_product_count: parseInt(item.distinct_product_count || '0', 10),
      distinct_store_count: parseInt(item.distinct_store_count || '0', 10),
    }));
  },

  getProductDistributionByTrip: async (tripId: string): Promise<Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    total_quantity: number;
    total_staff_count: number;
    quantity_per_staff: number;
    store_count: number;
    stores_detail: Array<{
      store_id: string;
      store_name: string | null;
      store_code: string | null;
      quantity: number;
    }>;
  }>> => {
    const { data, error } = await supabase
      .from('product_distribution_by_trip')
      .select('*')
      .eq('delivery_trip_id', tripId)
      .order('product_name');
    if (error) {
      console.error('[deliveryTripService] Error fetching product distribution:', error);
      throw error;
    }
    return (data || []).map((item: any) => ({
      product_id: item.product_id,
      product_code: item.product_code,
      product_name: item.product_name,
      category: item.category,
      unit: item.unit,
      total_quantity: parseFloat(item.total_quantity || '0'),
      total_staff_count: parseFloat(item.total_staff_count || '0'),
      quantity_per_staff: parseFloat(item.quantity_per_staff || '0'),
      store_count: parseInt(item.store_count || '0', 10),
      stores_detail: (item.stores_detail || []) as Array<{ store_id: string; store_name: string | null; store_code: string | null; quantity: number }>,
    }));
  },
};
