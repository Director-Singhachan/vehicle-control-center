// Delivery Trip Service - CRUD operations for delivery trips
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type DeliveryTrip = Database['public']['Tables']['delivery_trips']['Row'];
type DeliveryTripInsert = Database['public']['Tables']['delivery_trips']['Insert'];
type DeliveryTripUpdate = Database['public']['Tables']['delivery_trips']['Update'];
type DeliveryTripStore = Database['public']['Tables']['delivery_trip_stores']['Row'];
type DeliveryTripItem = Database['public']['Tables']['delivery_trip_items']['Row'];

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
}

export const deliveryTripService = {
  // Get all delivery trips
  getAll: async (filters?: {
    status?: string[];
    vehicle_id?: string;
    driver_id?: string;
    planned_date_from?: string;
    planned_date_to?: string;
  }): Promise<DeliveryTripWithRelations[]> => {
    // Build base query
    let query = supabase
      .from('delivery_trips')
      .select('*')
      .order('planned_date', { ascending: false })
      .order('created_at', { ascending: false });

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

    const { data: trips, error } = await query;

    if (error) {
      console.error('[deliveryTripService] Error fetching delivery trips:', error);
      throw error;
    }

    if (!trips || trips.length === 0) {
      return [];
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
    return trips.map(trip => {
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

  // Update delivery trip
  update: async (id: string, data: UpdateDeliveryTripData): Promise<DeliveryTripWithRelations> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Extract stores from data (it's a relation, not a column)
    const stores = data.stores;
    
    // Update trip basic info (exclude stores - it's not a column)
    // Create updateData without stores property to avoid PGRST204 error
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

    // Explicitly ensure stores is not in updateData (it's a relation, not a column)
    // This prevents PGRST204 error
    delete (updateData as any).stores;

    const { error: updateError } = await supabase
      .from('delivery_trips')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[deliveryTripService] Error updating trip:', updateError);
      throw updateError;
    }

    // If stores are provided, update them
    if (stores) {
      // Delete existing stores and items
      const { error: deleteStoresError } = await supabase
        .from('delivery_trip_stores')
        .delete()
        .eq('delivery_trip_id', id);

      if (deleteStoresError) {
        console.error('[deliveryTripService] Error deleting trip stores:', deleteStoresError);
        throw deleteStoresError;
      }

      // Recreate stores and items
      for (const storeData of stores) {
        const { data: tripStore, error: storeError } = await supabase
          .from('delivery_trip_stores')
          .insert({
            delivery_trip_id: id,
            store_id: storeData.store_id,
            sequence_order: storeData.sequence_order,
          })
          .select()
          .single();

        if (storeError) {
          console.error('[deliveryTripService] Error creating trip store:', storeError);
          throw storeError;
        }

        if (storeData.items && storeData.items.length > 0) {
          const itemsData = storeData.items.map(item => ({
            delivery_trip_id: id,
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
};

