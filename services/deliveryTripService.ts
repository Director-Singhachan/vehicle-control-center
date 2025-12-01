// Delivery Trip Service - CRUD operations for delivery trips
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type DeliveryTrip = Database['public']['Tables']['delivery_trips']['Row'];
type DeliveryTripInsert = Database['public']['Tables']['delivery_trips']['Insert'];
type DeliveryTripUpdate = Database['public']['Tables']['delivery_trips']['Update'];
type DeliveryTripStore = Database['public']['Tables']['delivery_trip_stores']['Row'];
type DeliveryTripItem = Database['public']['Tables']['delivery_trip_items']['Row'];
type DeliveryTripItemChange = Database['public']['Tables']['delivery_trip_item_changes']['Row'];

export interface DeliveryTripStoreWithDetails extends DeliveryTripStore {
  store?: {
    id: string;
    customer_code: string;
    customer_name: string;
    address?: string;
    phone?: string;
  };
  items?: DeliveryTripItemWithProduct[];
}

export interface DeliveryTripItemWithProduct extends DeliveryTripItem {
  product?: {
    id: string;
    category: string;
    product_code: string;
    product_name: string;
    unit: string;
  };
}

export interface DeliveryTripWithRelations extends DeliveryTrip {
  vehicle?: {
    plate: string;
    make?: string;
    model?: string;
  };
  driver?: {
    full_name: string;
    email?: string;
  };
  stores?: DeliveryTripStoreWithDetails[];
}

export interface DeliveryTripItemChangeWithDetails extends DeliveryTripItemChange {
  product?: {
    id: string;
    product_code: string;
    product_name: string;
    unit: string;
  } | null;
  store?: {
    id: string;
    customer_code: string;
    customer_name: string;
  } | null;
  user?: {
    id: string;
    full_name: string;
  } | null;
}

export interface CreateDeliveryTripData {
  vehicle_id: string;
  driver_id?: string;
  planned_date: string; // ISO date string
  odometer_start?: number;
  notes?: string;
  stores: Array<{
    store_id: string;
    sequence_order: number;
    items: Array<{
      product_id: string;
      quantity: number;
      notes?: string;
    }>;
  }>;
}

export interface UpdateDeliveryTripData {
  vehicle_id?: string;
  driver_id?: string;
  planned_date?: string;
  odometer_start?: number;
  odometer_end?: number;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  stores?: Array<{
    store_id: string;
    sequence_order: number;
    items: Array<{
      product_id: string;
      quantity: number;
      notes?: string;
    }>;
  }>;
  // Optional reason when modifying items for completed trips
  change_reason?: string;
}

export const deliveryTripService = {
  // Get all delivery trips (no pagination, for internal uses)
  getAll: async (filters?: {
    status?: string[];
    vehicle_id?: string;
    driver_id?: string;
    planned_date_from?: string;
    planned_date_to?: string;
  }): Promise<DeliveryTripWithRelations[]> => {
    const result = await deliveryTripService.getAllWithPagination({
      ...filters,
      page: 1,
      pageSize: 1000, // reasonable upper bound for internal non-paged uses
    });
    return result.trips;
  },

  // Get delivery trips with pagination (for list views)
  getAllWithPagination: async (filters?: {
    status?: string[];
    vehicle_id?: string;
    driver_id?: string;
    planned_date_from?: string;
    planned_date_to?: string;
    has_item_changes?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ trips: DeliveryTripWithRelations[]; total: number }> => {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters?.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build base query
    let query = supabase
      .from('delivery_trips')
      .select('*', { count: 'exact' })
      .order('planned_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.driver_id) {
      query = query.eq('driver_id', filters.driver_id);
    }
    if (filters?.planned_date_from) {
      query = query.gte('planned_date', filters.planned_date_from);
    }
    if (filters?.planned_date_to) {
      query = query.lte('planned_date', filters.planned_date_to);
    }
    if (typeof filters?.has_item_changes === 'boolean') {
      query = query.eq('has_item_changes', filters.has_item_changes);
    }

    const { data: trips, error, count } = await query;

    if (error) {
      console.error('[deliveryTripService] Error fetching delivery trips:', error);
      throw error;
    }

    if (!trips || trips.length === 0) {
      return { trips: [], total: 0 };
    }

    // Fetch related data separately to avoid relationship ambiguity
    const vehicleIds = [...new Set(trips.map(t => t.vehicle_id).filter(Boolean))];
    const driverIds = [...new Set(trips.map(t => t.driver_id).filter(Boolean))];

    // Fetch vehicles
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, plate, make, model')
      .in('id', vehicleIds);

    // Fetch drivers (profiles)
    const { data: drivers } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', driverIds);

    // Create lookup maps
    const vehicleMap = new Map((vehicles || []).map(v => [v.id, v]));
    const driverMap = new Map((drivers || []).map(d => [d.id, d]));

    // Fetch stores for all trips
    const tripIds = trips.map(t => t.id);
    const { data: tripStores } = tripIds.length > 0 ? await supabase
      .from('delivery_trip_stores')
      .select('*')
      .in('delivery_trip_id', tripIds)
      .order('sequence_order', { ascending: true }) : { data: [] };

    // Fetch stores separately
    const storeIds = [...new Set((tripStores || []).map(ts => ts.store_id).filter(Boolean))];
    const { data: stores } = storeIds.length > 0 ? await supabase
      .from('stores')
      .select('id, customer_code, customer_name, address, phone')
      .in('id', storeIds) : { data: [] };

    const storeMap = new Map((stores || []).map(s => [s.id, s]));

    // Group trip stores by trip_id
    const tripStoresMap = new Map<string, typeof tripStores>();
    (tripStores || []).forEach(ts => {
      if (!tripStoresMap.has(ts.delivery_trip_id)) {
        tripStoresMap.set(ts.delivery_trip_id, []);
      }
      tripStoresMap.get(ts.delivery_trip_id)!.push(ts);
    });

    // Combine data
    const combinedTrips = trips.map(trip => {
      const tripStoresForTrip = tripStoresMap.get(trip.id) || [];
      const storesWithDetails: DeliveryTripStoreWithDetails[] = tripStoresForTrip.map(ts => ({
        ...ts,
        store: storeMap.get(ts.store_id),
      }));

      return {
        ...trip,
        vehicle: vehicleMap.get(trip.vehicle_id),
        driver: driverMap.get(trip.driver_id),
        stores: storesWithDetails,
      };
    }) as DeliveryTripWithRelations[];

    return {
      trips: combinedTrips,
      total: count ?? combinedTrips.length,
    };
  },

  // Get delivery trip by ID with full relations
  getById: async (id: string): Promise<DeliveryTripWithRelations | null> => {
    // Get trip basic info
    const { data: trip, error: tripError } = await supabase
      .from('delivery_trips')
      .select('*')
      .eq('id', id)
      .single();

    if (tripError) {
      if (tripError.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[deliveryTripService] Error fetching trip:', tripError);
      throw tripError;
    }

    // Fetch vehicle and driver separately
    const [vehicleResult, driverResult] = await Promise.all([
      trip.vehicle_id ? supabase
        .from('vehicles')
        .select('id, plate, make, model')
        .eq('id', trip.vehicle_id)
        .single() : { data: null, error: null },
      trip.driver_id ? supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', trip.driver_id)
        .single() : { data: null, error: null },
    ]);

    const vehicle = vehicleResult.data;
    const driver = driverResult.data;

    // Get stores for this trip
    const { data: tripStores, error: storesError } = await supabase
      .from('delivery_trip_stores')
      .select('*')
      .eq('delivery_trip_id', id)
      .order('sequence_order', { ascending: true });

    if (storesError) {
      console.error('[deliveryTripService] Error fetching trip stores:', storesError);
      throw storesError;
    }

    // Fetch stores separately
    const storeIds = (tripStores || []).map(ts => ts.store_id).filter(Boolean);
    const { data: stores } = storeIds.length > 0 ? await supabase
      .from('stores')
      .select('id, customer_code, customer_name, address, phone')
      .in('id', storeIds) : { data: [] };

    const storeMap = new Map((stores || []).map(s => [s.id, s]));

    // Get items for each store
    const tripStoreIds = (tripStores || []).map(ts => ts.id);
    let items: DeliveryTripItemWithProduct[] = [];

    if (tripStoreIds.length > 0) {
      const { data: tripItems, error: itemsError } = await supabase
        .from('delivery_trip_items')
        .select('*')
        .in('delivery_trip_store_id', tripStoreIds)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('[deliveryTripService] Error fetching trip items:', itemsError);
        throw itemsError;
      }

      // Fetch products separately
      const productIds = (tripItems || []).map(item => item.product_id).filter(Boolean);
      const { data: products } = productIds.length > 0 ? await supabase
        .from('products')
        .select('id, category, product_code, product_name, unit')
        .in('id', productIds) : { data: [] };

      const productMap = new Map((products || []).map(p => [p.id, p]));

      items = (tripItems || []).map(item => ({
        ...item,
        product: productMap.get(item.product_id),
      })) as DeliveryTripItemWithProduct[];
    }

    // Combine stores with their items
    const storesWithItems: DeliveryTripStoreWithDetails[] = (tripStores || []).map(ts => ({
      ...ts,
      store: storeMap.get(ts.store_id),
      items: items.filter(item => item.delivery_trip_store_id === ts.id),
    }));

    return {
      ...trip,
      vehicle,
      driver,
      stores: storesWithItems,
    } as DeliveryTripWithRelations;
  },

  // Create delivery trip
  create: async (data: CreateDeliveryTripData): Promise<DeliveryTripWithRelations> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Start transaction-like operation
    // 1. Create delivery trip
    const tripData: DeliveryTripInsert = {
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id || user.id,
      planned_date: data.planned_date,
      odometer_start: data.odometer_start,
      notes: data.notes,
      created_by: user.id,
      updated_by: user.id,
    };

    const { data: trip, error: tripError } = await supabase
      .from('delivery_trips')
      .insert(tripData)
      .select()
      .single();

    if (tripError) {
      console.error('[deliveryTripService] Error creating trip:', tripError);
      throw tripError;
    }

    // 2. Create delivery trip stores and items
    for (const storeData of data.stores) {
      // Create trip store
      const { data: tripStore, error: storeError } = await supabase
        .from('delivery_trip_stores')
        .insert({
          delivery_trip_id: trip.id,
          store_id: storeData.store_id,
          sequence_order: storeData.sequence_order,
        })
        .select()
        .single();

      if (storeError) {
        console.error('[deliveryTripService] Error creating trip store:', storeError);
        throw storeError;
      }

      // Create trip items for this store
      if (storeData.items && storeData.items.length > 0) {
        const itemsData = storeData.items.map(item => ({
          delivery_trip_id: trip.id,
          delivery_trip_store_id: tripStore.id,
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes,
        }));

        const { error: itemsError } = await supabase
          .from('delivery_trip_items')
          .insert(itemsData);

        if (itemsError) {
          console.error('[deliveryTripService] Error creating trip items:', itemsError);
          throw itemsError;
        }
      }
    }

    // Return full trip with relations
    const fullTrip = await deliveryTripService.getById(trip.id);
    if (!fullTrip) {
      throw new Error('Failed to retrieve created trip');
    }

    return fullTrip;
  },

  // Update delivery trip (including stores & items, with audit logging)
  update: async (id: string, data: UpdateDeliveryTripData): Promise<DeliveryTripWithRelations> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Extract relation data & reason from input (not direct columns)
    const stores = data.stores;
    const changeReason = data.change_reason;
    let itemChangesOccurred = false;
    
    // Update trip basic info (exclude stores/change_reason - they are not columns)
    // Create updateData without relation fields to avoid PGRST204 error
    const updateData: DeliveryTripUpdate = {
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      planned_date: data.planned_date,
      odometer_start: data.odometer_start,
      odometer_end: data.odometer_end,
      status: data.status,
      notes: data.notes,
      updated_by: user.id,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof DeliveryTripUpdate] === undefined) {
        delete updateData[key as keyof DeliveryTripUpdate];
      }
    });

    // Explicitly ensure relation-only fields are not in updateData
    delete (updateData as any).stores;
    delete (updateData as any).change_reason;

    const { error: updateError } = await supabase
      .from('delivery_trips')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[deliveryTripService] Error updating trip:', updateError);
      throw updateError;
    }

    // If stores are provided, update them with audit logging
    if (stores) {
      // 1) Load existing stores & items to compare
      const { data: existingStores, error: existingStoresError } = await supabase
        .from('delivery_trip_stores')
        .select('id, store_id, sequence_order, delivery_status')
        .eq('delivery_trip_id', id);

      if (existingStoresError) {
        console.error('[deliveryTripService] Error loading existing trip stores:', existingStoresError);
        throw existingStoresError;
      }

      const existingStoreIds = (existingStores || []).map(s => s.id);

      const { data: existingItems, error: existingItemsError } = existingStoreIds.length > 0 ? await supabase
        .from('delivery_trip_items')
        .select('id, delivery_trip_store_id, product_id, quantity')
        .in('delivery_trip_store_id', existingStoreIds) : { data: [], error: null };

      if (existingItemsError) {
        console.error('[deliveryTripService] Error loading existing trip items:', existingItemsError);
        throw existingItemsError;
      }

      const existingStoreMap = new Map((existingStores || []).map(s => [s.store_id, s]));
      const existingItemsByStore = new Map<string, typeof existingItems>();
      (existingItems || []).forEach(item => {
        const key = item.delivery_trip_store_id;
        if (!existingItemsByStore.has(key)) {
          existingItemsByStore.set(key, []);
        }
        existingItemsByStore.get(key)!.push(item);
      });

      // 2) Build mapping of new stores by store_id
      const newStoresByStoreId = new Map<string, typeof stores[0]>();
      for (const store of stores) {
        newStoresByStoreId.set(store.store_id, store);
      }

      // Helper to create change log
      const insertChangeLog = async (params: {
        action: 'add' | 'update' | 'remove';
        delivery_trip_store_id: string | null;
        delivery_trip_item_id: string | null;
        product_id: string | null;
        old_quantity: number | null;
        new_quantity: number | null;
      }) => {
        const { action, delivery_trip_store_id, delivery_trip_item_id, product_id, old_quantity, new_quantity } = params;
        itemChangesOccurred = true;
        const { error: logError } = await supabase
          .from('delivery_trip_item_changes')
          .insert({
            delivery_trip_id: id,
            delivery_trip_store_id,
            delivery_trip_item_id,
            product_id,
            action,
            old_quantity,
            new_quantity,
            reason: changeReason || null,
            created_by: user.id,
          });

        if (logError) {
          console.error('[deliveryTripService] Error logging item change:', logError);
          // ไม่ throw เพื่อไม่ให้การอัปเดตหลักล้มเหลวเพราะ log แต่จะพิมพ์เตือนใน console
        }
      };

      // 3) Delete stores (and their items) that are no longer present
      const storeIdsToRemove = (existingStores || [])
        .filter(s => !newStoresByStoreId.has(s.store_id))
        .map(s => s.id);

      if (storeIdsToRemove.length > 0) {
        // Load items for these stores to log removals
        const { data: removedStoreItems } = await supabase
          .from('delivery_trip_items')
          .select('id, delivery_trip_store_id, product_id, quantity')
          .in('delivery_trip_store_id', storeIdsToRemove);

        if (removedStoreItems && removedStoreItems.length > 0) {
          for (const item of removedStoreItems) {
            await insertChangeLog({
              action: 'remove',
              delivery_trip_store_id: item.delivery_trip_store_id,
              delivery_trip_item_id: item.id,
              product_id: item.product_id,
              old_quantity: Number(item.quantity),
              new_quantity: null,
            });
          }
        }

        const { error: deleteRemovedStoresError } = await supabase
          .from('delivery_trip_stores')
          .delete()
          .in('id', storeIdsToRemove);

        if (deleteRemovedStoresError) {
          console.error('[deliveryTripService] Error deleting removed trip stores:', deleteRemovedStoresError);
          throw deleteRemovedStoresError;
        }
      }

      // 4) Upsert stores and items for each provided store
      for (const storeData of stores) {
        const existingStore = existingStoreMap.get(storeData.store_id);
        let tripStoreId: string;

        if (!existingStore) {
          // New store for this trip
          const { data: tripStore, error: storeError } = await supabase
            .from('delivery_trip_stores')
            .insert({
              delivery_trip_id: id,
              store_id: storeData.store_id,
              sequence_order: storeData.sequence_order,
            })
            .select()
            .single();

          if (storeError || !tripStore) {
            console.error('[deliveryTripService] Error creating trip store:', storeError);
            throw storeError;
          }

          tripStoreId = tripStore.id;
        } else {
          // Existing store: update basic info if needed
          tripStoreId = existingStore.id;

          if (existingStore.sequence_order !== storeData.sequence_order) {
            const { error: updateStoreError } = await supabase
              .from('delivery_trip_stores')
              .update({ sequence_order: storeData.sequence_order })
              .eq('id', existingStore.id);

            if (updateStoreError) {
              console.error('[deliveryTripService] Error updating trip store sequence:', updateStoreError);
              throw updateStoreError;
            }
          }
        }

        // Items for this store
        const existingItemsForStore = existingStore
          ? (existingItemsByStore.get(existingStore.id) || [])
          : [];

        const existingItemsMap = new Map(
          existingItemsForStore.map(item => [`${item.product_id}`, item])
        );

        const newItemsMap = new Map<string, { product_id: string; quantity: number; notes?: string }>();
        for (const item of storeData.items || []) {
          newItemsMap.set(item.product_id, item);
        }

        // Remove items that are not in new list
        const itemsToRemove = existingItemsForStore.filter(
          item => !newItemsMap.has(item.product_id)
        );

        if (itemsToRemove.length > 0) {
          // Log removals BEFORE deleting rows, otherwise FK บน delivery_trip_item_id จะหา record ไม่เจอ
          for (const item of itemsToRemove) {
            await insertChangeLog({
              action: 'remove',
              delivery_trip_store_id: item.delivery_trip_store_id,
              delivery_trip_item_id: item.id,
              product_id: item.product_id,
              old_quantity: Number(item.quantity),
              new_quantity: null,
            });
          }

          const itemIdsToRemove = itemsToRemove.map(i => i.id);

          const { error: deleteItemsError } = await supabase
            .from('delivery_trip_items')
            .delete()
            .in('id', itemIdsToRemove);

          if (deleteItemsError) {
            console.error('[deliveryTripService] Error deleting removed trip items:', deleteItemsError);
            throw deleteItemsError;
          }
        }

        // Add or update items
        for (const item of storeData.items || []) {
          const existingItem = existingItemsMap.get(item.product_id);

          if (!existingItem) {
            // New item
            const { data: insertedItems, error: insertItemError } = await supabase
              .from('delivery_trip_items')
              .insert({
                delivery_trip_id: id,
                delivery_trip_store_id: tripStoreId,
                product_id: item.product_id,
                quantity: item.quantity,
                notes: item.notes,
              })
              .select();

            if (insertItemError || !insertedItems || insertedItems.length === 0) {
              console.error('[deliveryTripService] Error creating trip item:', insertItemError);
              throw insertItemError;
            }

            const insertedItem = insertedItems[0];

            await insertChangeLog({
              action: 'add',
              delivery_trip_store_id: tripStoreId,
              delivery_trip_item_id: insertedItem.id,
              product_id: insertedItem.product_id,
              old_quantity: null,
              new_quantity: Number(insertedItem.quantity),
            });
          } else {
            // Possibly update existing item
            const oldQty = Number(existingItem.quantity);
            const newQty = Number(item.quantity);

            const needsUpdate = oldQty !== newQty || (item.notes !== undefined);

            if (needsUpdate) {
              const { error: updateItemError } = await supabase
                .from('delivery_trip_items')
                .update({
                  quantity: item.quantity,
                  notes: item.notes,
                })
                .eq('id', existingItem.id);

              if (updateItemError) {
                console.error('[deliveryTripService] Error updating trip item:', updateItemError);
                throw updateItemError;
              }

              await insertChangeLog({
                action: 'update',
                delivery_trip_store_id: existingItem.delivery_trip_store_id,
                delivery_trip_item_id: existingItem.id,
                product_id: existingItem.product_id,
                old_quantity: oldQty,
                new_quantity: newQty,
              });
            }
          }
        }
      }
    }

    // If any item changes occurred, mark trip as having item changes
    if (itemChangesOccurred) {
      const nowIso = new Date().toISOString();
      const { error: flagError } = await supabase
        .from('delivery_trips')
        // cast as any because generated types may not know these new columns yet
        .update({ has_item_changes: true, last_item_change_at: nowIso } as any)
        .eq('id', id);

      if (flagError) {
        console.error('[deliveryTripService] Error updating item change flags on trip:', flagError);
      }
    }

    // Return updated trip
    const updatedTrip = await deliveryTripService.getById(id);
    if (!updatedTrip) {
      throw new Error('Failed to retrieve updated trip');
    }

    return updatedTrip;
  },

  // Delete delivery trip
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('delivery_trips')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deliveryTripService] Error deleting trip:', error);
      throw error;
    }
  },

  // Get aggregated products for a trip (all products across all stores)
  getAggregatedProducts: async (tripId: string): Promise<Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    total_quantity: number;
    stores: Array<{
      store_id: string;
      customer_code: string;
      customer_name: string;
      quantity: number;
    }>;
  }>> => {
    const trip = await deliveryTripService.getById(tripId);
    if (!trip || !trip.stores) {
      return [];
    }

    // Aggregate products across all stores
    const productMap = new Map<string, {
      product_id: string;
      product_code: string;
      product_name: string;
      category: string;
      unit: string;
      total_quantity: number;
      stores: Array<{
        store_id: string;
        customer_code: string;
        customer_name: string;
        quantity: number;
      }>;
    }>();

    for (const store of trip.stores) {
      if (!store.items) continue;

      for (const item of store.items) {
        if (!item.product) continue;

        const productId = item.product.id;
        const existing = productMap.get(productId);

        if (existing) {
          existing.total_quantity += Number(item.quantity);
          existing.stores.push({
            store_id: store.store_id,
            customer_code: store.store?.customer_code || '',
            customer_name: store.store?.customer_name || '',
            quantity: Number(item.quantity),
          });
        } else {
          productMap.set(productId, {
            product_id: productId,
            product_code: item.product.product_code,
            product_name: item.product.product_name,
            category: item.product.category,
            unit: item.product.unit,
            total_quantity: Number(item.quantity),
            stores: [{
              store_id: store.store_id,
              customer_code: store.store?.customer_code || '',
              customer_name: store.store?.customer_name || '',
              quantity: Number(item.quantity),
            }],
          });
        }
      }
    }

    return Array.from(productMap.values());
  },

  // Get item change history (audit log) for a trip
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

    if (!changes || changes.length === 0) {
      return [];
    }

    // Collect IDs for lookup
    const productIds = [...new Set(changes.map(c => c.product_id).filter(Boolean))] as string[];
    const tripStoreIds = [...new Set(changes.map(c => c.delivery_trip_store_id).filter(Boolean))] as string[];
    const userIds = [...new Set(changes.map(c => c.created_by).filter(Boolean))] as string[];

    const [productsResult, tripStoresResult, usersResult] = await Promise.all([
      productIds.length
        ? supabase
            .from('products')
            .select('id, product_code, product_name, unit')
            .in('id', productIds)
        : Promise.resolve({ data: null, error: null } as any),
      tripStoreIds.length
        ? supabase
            .from('delivery_trip_stores')
            .select('id, store_id')
            .in('id', tripStoreIds)
        : Promise.resolve({ data: null, error: null } as any),
      userIds.length
        ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    const products = (productsResult as any).data || [];
    const tripStores = (tripStoresResult as any).data || [];
    const users = (usersResult as any).data || [];

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // For stores we need to go from delivery_trip_stores -> stores
    const storeIds = [...new Set(tripStores.map((ts: any) => ts.store_id).filter(Boolean))];
    const { data: storesData } = storeIds.length
      ? await supabase
          .from('stores')
          .select('id, customer_code, customer_name')
          .in('id', storeIds)
      : { data: [] as any[] };

    const storeMap = new Map(storesData.map((s: any) => [s.id, s]));
    const tripStoreToStoreMap = new Map(
      tripStores.map((ts: any) => [ts.id, storeMap.get(ts.store_id)])
    );

    const userMap = new Map(users.map((u: any) => [u.id, u]));

    return changes.map(change => ({
      ...change,
      product: change.product_id ? productMap.get(change.product_id) || null : null,
      store: change.delivery_trip_store_id
        ? (tripStoreToStoreMap.get(change.delivery_trip_store_id) as any) || null
        : null,
      user: change.created_by ? userMap.get(change.created_by) || null : null,
    })) as DeliveryTripItemChangeWithDetails[];
  },
};

