// Delivery Trip Service - CRUD operations for delivery trips
import { supabase } from '../lib/supabase';
import { withRetry } from '../lib/retry';
import type { Database } from '../types/database';

type DeliveryTrip = Database['public']['Tables']['delivery_trips']['Row'];
type DeliveryTripInsert = Database['public']['Tables']['delivery_trips']['Insert'];
type DeliveryTripUpdate = Database['public']['Tables']['delivery_trips']['Update'];
type DeliveryTripStore = Database['public']['Tables']['delivery_trip_stores']['Row'];
type DeliveryTripItem = Database['public']['Tables']['delivery_trip_items']['Row'];
type DeliveryTripItemChange = Database['public']['Tables']['delivery_trip_item_changes']['Row'];
type DeliveryTripCrew = Database['public']['Tables']['delivery_trip_crews']['Row'];
type DeliveryTripCrewInsert = Database['public']['Tables']['delivery_trip_crews']['Insert'];

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

export interface DeliveryTripCrewWithDetails extends DeliveryTripCrew {
  staff?: {
    id: string;
    name: string;
    employee_code?: string;
    phone?: string;
  };
}

export interface DeliveryTripWithRelations extends DeliveryTrip {
  vehicle?: {
    plate: string;
    make?: string;
    model?: string;
    image_url?: string | null;
  };
  driver?: {
    full_name: string;
    email?: string;
    avatar_url?: string | null;
  };
  stores?: DeliveryTripStoreWithDetails[];
  crews?: DeliveryTripCrewWithDetails[];
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
  helpers?: string[]; // Array of service_staff IDs
  planned_date: string; // ISO date string
  odometer_start?: number;
  manual_distance_km?: number; // Added support for manual distance
  notes?: string;
  sequence_order?: number; // Optional: if not provided, will be auto-calculated
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
  sequence_order?: number; // Update sequence order if needed
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
    sortAscending?: boolean; // If true, sort by planned_date ASC (earliest first)
    lite?: boolean; // If false, fetch full store details
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
    lite?: boolean;
    sortAscending?: boolean; // If true, sort by planned_date ASC (earliest first)
  }): Promise<{ trips: DeliveryTripWithRelations[]; total: number }> => {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters?.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const lite = filters?.lite !== false; // Default to lite mode if not specified
    const sortAscending = filters?.sortAscending === true; // Default to false (DESC)

    // Use retry logic for connection errors
    const { data: trips, error, count } = await withRetry(async () => {
      // Build base query inside retry function
      // Default: Show newest trips first (DESC)
      // If sortAscending=true: Show oldest trips first (ASC) - useful for selecting earliest planned trip

      let query = supabase
        .from('delivery_trips')
        .select(lite
          ? 'id, trip_number, status, planned_date, vehicle_id, driver_id, has_item_changes, odometer_start, notes, sequence_order, created_at'
          : '*',
          { count: 'exact' }
        )
        .order('planned_date', { ascending: sortAscending })
        .order('created_at', { ascending: sortAscending })
        .order('sequence_order', { ascending: true })
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

      const result = await query;
      if (result.error) {
        throw result.error;
      }
      return result;
    }, {
      maxRetries: 3,
      initialDelay: 1000,
    });

    if (error) {
      console.error('[deliveryTripService] Error fetching delivery trips:', error);
      // Create a more user-friendly error message
      const isConnectionError = error.message?.includes('Failed to fetch') ||
        error.message?.includes('ERR_CONNECTION_CLOSED') ||
        error.code === 'ERR_CONNECTION_CLOSED';

      if (isConnectionError) {
        const friendlyError = new Error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองอีกครั้ง');
        (friendlyError as any).originalError = error;
        throw friendlyError;
      }
      throw error;
    }

    if (!trips || trips.length === 0) {
      return { trips: [], total: 0 };
    }

    // Fetch related data separately to avoid relationship ambiguity
    const vehicleIds = [...new Set(trips.map(t => t.vehicle_id).filter(Boolean))];
    const driverIds = [...new Set(trips.map(t => t.driver_id).filter(Boolean))];

    // Fetch vehicles
    // Guard empty arrays to avoid Supabase `.in` error
    const { data: vehicles } = vehicleIds.length > 0
      ? await supabase
        .from('vehicles')
        .select('id, plate, make, model, image_url')
        .in('id', vehicleIds)
      : { data: [] as any[] };

    // Fetch drivers (profiles) with same guard
    const { data: drivers } = driverIds.length > 0
      ? await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', driverIds)
      : { data: [] as any[] };

    // Create lookup maps
    const vehicleMap = new Map((vehicles || []).map(v => [v.id, v]));
    const driverMap = new Map((drivers || []).map(d => [d.id, d]));

    // Fetch stores for all trips
    // In lite mode, we only need basic info (or just count if we wanted to be super minimal, 
    // but the UI currently shows "X Stores" based on array length, so we need the count)
    const tripIds = trips.map(t => t.id);
    const { data: tripStores } = tripIds.length > 0 ? await supabase
      .from('delivery_trip_stores')
      .select('id, delivery_trip_store_id:id, delivery_trip_id, store_id, sequence_order') // Minimally select needed fields
      .in('delivery_trip_id', tripIds)
      .order('sequence_order', { ascending: true }) : { data: [] };

    // Group trip stores by trip_id
    const tripStoresMap = new Map<string, typeof tripStores>();
    (tripStores || []).forEach(ts => {
      if (!tripStoresMap.has(ts.delivery_trip_id)) {
        tripStoresMap.set(ts.delivery_trip_id, []);
      }
      tripStoresMap.get(ts.delivery_trip_id)!.push(ts);
    });

    let storeMap = new Map<string, any>();

    // In FULL mode only, fetch detailed store info
    if (!lite) {
      const storeIds = [...new Set((tripStores || []).map(ts => ts.store_id).filter(Boolean))];
      const { data: stores } = storeIds.length > 0 ? await supabase
        .from('stores')
        .select('id, customer_code, customer_name, address, phone')
        .in('id', storeIds) : { data: [] };

      storeMap = new Map((stores || []).map(s => [s.id, s]));
    }

    // Combine data
    const combinedTrips = trips.map(trip => {
      const tripStoresForTrip = tripStoresMap.get(trip.id) || [];
      const storesWithDetails: DeliveryTripStoreWithDetails[] = tripStoresForTrip.map(ts => ({
        ...ts,
        // In lite mode, store detail will be undefined, which is fine for list view specific needs
        // The list view primarily checks `stores.length`
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
    // Get trip basic info with retry
    const { data: trip, error: tripError } = await withRetry(async () => {
      const result = await supabase
        .from('delivery_trips')
        .select('*')
        .eq('id', id)
        .single();
      if (result.error) {
        throw result.error;
      }
      return result;
    }, {
      maxRetries: 3,
      initialDelay: 1000,
    });

    if (tripError) {
      if (tripError.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[deliveryTripService] Error fetching trip:', tripError);

      // Create a more user-friendly error message for connection errors
      const isConnectionError = tripError.message?.includes('Failed to fetch') ||
        tripError.message?.includes('ERR_CONNECTION_CLOSED') ||
        tripError.code === 'ERR_CONNECTION_CLOSED';

      if (isConnectionError) {
        const friendlyError = new Error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองอีกครั้ง');
        (friendlyError as any).originalError = tripError;
        throw friendlyError;
      }

      throw tripError;
    }

    // Fetch vehicle and driver separately
    const [vehicleResult, driverResult] = await Promise.all([
      trip.vehicle_id ? supabase
        .from('vehicles')
        .select('id, plate, make, model, image_url')
        .eq('id', trip.vehicle_id)
        .single() : { data: null, error: null },
      trip.driver_id ? supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
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

    // Get crews for this trip
    const { data: tripCrews, error: crewsError } = await supabase
      .from('delivery_trip_crews')
      .select('*')
      .eq('delivery_trip_id', id)
      .order('created_at', { ascending: true });

    if (crewsError) {
      console.error('[deliveryTripService] Error fetching trip crews:', crewsError);
      // Don't throw, just continue without crews
    }

    // Fetch staff details for crews
    let crewsWithDetails: DeliveryTripCrewWithDetails[] = [];
    if (tripCrews && tripCrews.length > 0) {
      const staffIds = tripCrews.map(c => c.staff_id);
      const { data: staffList } = await supabase
        .from('service_staff')
        .select('id, name, employee_code, phone')
        .in('id', staffIds);

      const staffMap = new Map((staffList || []).map(s => [s.id, s]));

      crewsWithDetails = tripCrews.map(crew => ({
        ...crew,
        staff: staffMap.get(crew.staff_id),
      }));
    }

    return {
      ...trip,
      vehicle,
      driver,
      stores: storesWithItems,
      crews: crewsWithDetails,
    } as DeliveryTripWithRelations;
  },

  // Create delivery trip
  create: async (data: CreateDeliveryTripData): Promise<DeliveryTripWithRelations> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Calculate sequence_order if not provided
    // Get the max sequence_order for this vehicle on the same planned_date
    let sequenceOrder = data.sequence_order;
    if (sequenceOrder === undefined) {
      const { data: existingTrips } = await supabase
        .from('delivery_trips')
        .select('sequence_order')
        .eq('vehicle_id', data.vehicle_id)
        .eq('planned_date', data.planned_date)
        .order('sequence_order', { ascending: false })
        .limit(1);

      const maxSequence = existingTrips && existingTrips.length > 0
        ? (existingTrips[0].sequence_order || 0)
        : 0;
      sequenceOrder = maxSequence + 1;
    }

    // Start transaction-like operation
    // 1. Create delivery trip
    const tripData: DeliveryTripInsert = {
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id || user.id,
      planned_date: data.planned_date,
      odometer_start: data.odometer_start,
      manual_distance_km: data.manual_distance_km,
      notes: data.notes,
      sequence_order: sequenceOrder,
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

    // 1.5 Ensure driver is also present in delivery_trip_crews as role = 'driver'
    try {
      if (trip.driver_id) {
        // Check if there is already an active driver crew for this trip (in case user added manually)
        const { data: existingDriverCrews } = await supabase
          .from('delivery_trip_crews')
          .select('id')
          .eq('delivery_trip_id', trip.id)
          .eq('role', 'driver')
          .eq('status', 'active')
          .limit(1);

        const hasDriverCrew = (existingDriverCrews || []).length > 0;

        if (!hasDriverCrew) {
          // Find matching service_staff by driver profile name
          const { data: driverProfile } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', trip.driver_id)
            .single();

          if (driverProfile?.full_name) {
            const driverName = driverProfile.full_name.trim();

            const { data: staffMatches, error: staffError } = await supabase
              .from('service_staff')
              .select('id, name, status')
              .eq('name', driverName)
              .limit(5);

            if (staffError) {
              console.error('[deliveryTripService] Error matching driver to service_staff:', staffError);
            } else if (staffMatches && staffMatches.length > 0) {
              // Prefer active staff, fall back to first match
              const staff =
                staffMatches.find(s => s.status === 'active') ||
                staffMatches[0];

              if (staff) {
                const now = new Date().toISOString();

                const { error: insertDriverCrewError } = await supabase
                  .from('delivery_trip_crews')
                  .insert({
                    delivery_trip_id: trip.id,
                    staff_id: staff.id,
                    role: 'driver',
                    status: 'active',
                    start_at: now,
                    created_by: user.id,
                    updated_by: user.id,
                  });

                if (insertDriverCrewError) {
                  console.error('[deliveryTripService] Error creating driver crew from trip driver_id:', insertDriverCrewError);
                } else {
                  console.log('[deliveryTripService] Synced driver to delivery_trip_crews as driver role:', {
                    trip_id: trip.id,
                    driver_profile_id: trip.driver_id,
                    staff_id: staff.id,
                  });
                }
              }
            } else {
              console.warn('[deliveryTripService] No matching service_staff found for driver profile name. Driver will not be included in crew automatically.', {
                trip_id: trip.id,
                driver_profile_id: trip.driver_id,
                driver_name: driverName,
              });
            }
          }
        }
      }
    } catch (driverCrewError) {
      console.error('[deliveryTripService] Failed to sync driver to delivery_trip_crews:', driverCrewError);
      // Do not throw – trip creation should still succeed
    }

    // 1.6 Create helpers (crew)
    if (data.helpers && data.helpers.length > 0) {
      const crewData = data.helpers.map(staffId => ({
        delivery_trip_id: trip.id,
        staff_id: staffId,
        role: 'helper',
        status: 'active',
        start_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      }));

      const { error: crewError } = await supabase
        .from('delivery_trip_crews')
        .insert(crewData);

      if (crewError) {
        console.error('[deliveryTripService] Error creating trip crew:', crewError);
        throw crewError;
      }
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
      sequence_order: data.sequence_order,
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
        .in('delivery_trip_store_id', existingStoreIds) : { data: [] as any[], error: null };

      if (existingItemsError) {
        console.error('[deliveryTripService] Error loading existing trip items:', existingItemsError);
        throw existingItemsError;
      }

      const existingStoreMap = new Map((existingStores as any[] || []).map(s => [s.store_id, s]));
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
            change_type: action,
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
        type TripItemRow = {
          id: string;
          delivery_trip_store_id: string;
          product_id: string;
          quantity: number;
          notes?: string | null;
        };

        const existingItemsForStore: TripItemRow[] = existingStore
          ? ((existingItemsByStore.get(existingStore.id) || []) as TripItemRow[])
          : [];

        const existingItemsMap = new Map<string, TripItemRow>(
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
        .update({ has_item_changes: true, last_item_change_at: nowIso })
        .eq('id', id);

      if (flagError) {
        console.error('[deliveryTripService] Error updating item change flags on trip:', flagError);
      } else {
        // ถ้าทริปนี้เป็นสถานะ completed แล้ว และมีการแก้ไขสินค้า → เรียกคำนวณค่าคอมใหม่อัตโนมัติ
        try {
          const { data: updatedTrip } = await supabase
            .from('delivery_trips')
            .select('id, status, trip_number')
            .eq('id', id)
            .single();

          if (updatedTrip && updatedTrip.status === 'completed') {
            console.log(
              '[deliveryTripService] Trip items changed for completed trip. Invoking auto-commission-worker:',
              {
                trip_id: updatedTrip.id,
                trip_number: updatedTrip.trip_number,
              }
            );

            await supabase.functions.invoke('auto-commission-worker', {
              body: {
                source: 'trip_items_update',
                trip_id: updatedTrip.id,
              },
            });
          }
        } catch (commissionRecalcError) {
          console.warn(
            '[deliveryTripService] Failed to invoke auto-commission-worker after item changes:',
            commissionRecalcError
          );
          // ไม่ throw ต่อ เพื่อไม่ให้กระทบ UX การแก้ไขทริป
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

  // Cancel delivery trip (set status to 'cancelled')
  cancel: async (id: string, reason?: string): Promise<DeliveryTripWithRelations> => {
    console.log('[deliveryTripService] cancel called with:', { id, reason: reason ? 'provided' : 'none' });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[deliveryTripService] Auth error:', authError);
      throw new Error('Authentication error: ' + authError.message);
    }

    if (!user) {
      console.error('[deliveryTripService] User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log('[deliveryTripService] User authenticated:', user.id);

    // Get the trip to validate
    console.log('[deliveryTripService] Fetching trip:', id);
    const trip = await deliveryTripService.getById(id);
    if (!trip) {
      console.error('[deliveryTripService] Trip not found:', id);
      throw new Error('Trip not found');
    }

    console.log('[deliveryTripService] Trip found:', {
      id: trip.id,
      trip_number: trip.trip_number,
      status: trip.status,
      vehicle_id: trip.vehicle_id,
    });

    // Only allow cancelling planned or in_progress trips
    if (trip.status === 'completed') {
      console.error('[deliveryTripService] Cannot cancel completed trip');
      throw new Error('ไม่สามารถยกเลิกทริปที่จัดส่งเสร็จแล้วได้');
    }

    if (trip.status === 'cancelled') {
      console.error('[deliveryTripService] Trip already cancelled');
      throw new Error('ทริปนี้ถูกยกเลิกไปแล้ว');
    }

    if (trip.status !== 'planned' && trip.status !== 'in_progress') {
      console.error('[deliveryTripService] Invalid status for cancellation:', trip.status);
      throw new Error(`ไม่สามารถยกเลิกทริปที่มีสถานะ "${trip.status}" ได้ (ยกเลิกได้เฉพาะทริปที่ "รอจัดส่ง" หรือ "กำลังจัดส่ง")`);
    }

    // Update trip status to cancelled
    const updateData: DeliveryTripUpdate = {
      status: 'cancelled',
      notes: reason ? `${trip.notes || ''}\n[ยกเลิก] ${reason}`.trim() : trip.notes,
      updated_by: user.id,
    };

    console.log('[deliveryTripService] Updating trip with data:', {
      status: updateData.status,
      has_notes: !!updateData.notes,
      updated_by: updateData.updated_by,
    });

    const { data: updatedData, error: updateError } = await supabase
      .from('delivery_trips')
      .update(updateData)
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('[deliveryTripService] Error cancelling trip:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });

      // Provide more specific error messages
      if (updateError.code === '42501') {
        throw new Error('คุณไม่มีสิทธิ์ในการยกเลิกทริปนี้ (ต้องเป็น Admin, Manager, Inspector หรือคนขับของทริปนี้)');
      } else if (updateError.code === 'PGRST116') {
        throw new Error('ไม่พบทริปที่ต้องการยกเลิก');
      } else {
        throw new Error(`เกิดข้อผิดพลาดในการยกเลิกทริป: ${updateError.message || 'Unknown error'}`);
      }
    }

    console.log('[deliveryTripService] Trip updated successfully:', updatedData?.[0]?.id);

    // Return updated trip
    const updatedTrip = await deliveryTripService.getById(id);
    if (!updatedTrip) {
      console.error('[deliveryTripService] Failed to retrieve cancelled trip');
      throw new Error('ไม่สามารถดึงข้อมูลทริปที่ยกเลิกแล้วได้');
    }

    console.log('[deliveryTripService] Cancel completed successfully');
    return updatedTrip;
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

  // Change vehicle for delivery trip
  changeVehicle: async (
    tripId: string,
    newVehicleId: string,
    reason: string
  ): Promise<DeliveryTripWithRelations> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // ดึงข้อมูล delivery trip
    const trip = await deliveryTripService.getById(tripId);
    if (!trip) throw new Error('Delivery trip not found');

    // ตรวจสอบสถานะ - ต้องเป็น planned หรือ in_progress เท่านั้น
    if (!['planned', 'in_progress'].includes(trip.status)) {
      throw new Error('ไม่สามารถเปลี่ยนรถสำหรับทริปที่เสร็จสิ้นหรือยกเลิกแล้ว');
    }

    const oldVehicleId = trip.vehicle_id;

    // ตรวจสอบว่าเป็นรถคันเดียวกันหรือไม่
    if (oldVehicleId === newVehicleId) {
      throw new Error('รถคันใหม่ต้องไม่ใช่รถคันเดิม');
    }

    // อัปเดตรถใหม่
    const { error: updateError } = await supabase
      .from('delivery_trips')
      .update({
        vehicle_id: newVehicleId,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', tripId);

    if (updateError) {
      console.error('[deliveryTripService] Error updating vehicle:', updateError);
      throw updateError;
    }

    // บันทึก log การเปลี่ยนรถ
    const { error: logError } = await supabase
      .from('delivery_trip_vehicle_changes')
      .insert({
        delivery_trip_id: tripId,
        old_vehicle_id: oldVehicleId,
        new_vehicle_id: newVehicleId,
        reason,
        changed_by: user.id,
        changed_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('[deliveryTripService] Error logging vehicle change:', logError);
      // Don't throw - continue even if logging fails
    }

    // ยกเลิกการผูก trip logs ที่มีอยู่
    // เพราะรถเปลี่ยนแล้ว trip log เก่าไม่ควรผูกกับทริปนี้
    const { error: unlinkError } = await supabase
      .from('trip_logs')
      .update({ delivery_trip_id: null })
      .eq('delivery_trip_id', tripId);

    if (unlinkError) {
      console.error('[deliveryTripService] Error unlinking trip logs:', unlinkError);
      // Don't throw - this is not critical
    }

    console.log('[deliveryTripService] Vehicle changed successfully:', {
      trip_id: tripId,
      old_vehicle_id: oldVehicleId,
      new_vehicle_id: newVehicleId,
      reason,
    });

    return deliveryTripService.getById(tripId) as Promise<DeliveryTripWithRelations>;
  },

  // Sync delivery trips status with completed trip_logs
  // This fixes delivery trips that should be 'completed' but are still 'planned' or 'in_progress'
  syncStatusWithTripLogs: async (): Promise<{
    updated: number;
    details: Array<{
      trip_id: string;
      trip_number: string;
      old_status: string;
      new_status: string;
    }>;
  }> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const updatedTrips: Array<{
      trip_id: string;
      trip_number: string;
      old_status: string;
      new_status: string;
    }> = [];

    // Find delivery trips that are still 'planned' or 'in_progress'
    // but have completed trip_logs
    const { data: tripsToFix, error: fetchError } = await supabase
      .from('delivery_trips')
      .select(`
        id,
        trip_number,
        vehicle_id,
        driver_id,
        planned_date,
        status,
        odometer_start,
        odometer_end
      `)
      .in('status', ['planned', 'in_progress'])
      .lte('planned_date', new Date().toISOString().split('T')[0]);

    if (fetchError) {
      console.error('[deliveryTripService] Error fetching trips to fix:', fetchError);
      throw fetchError;
    }

    if (!tripsToFix || tripsToFix.length === 0) {
      return { updated: 0, details: [] };
    }

    // For each trip, find matching completed trip_log
    for (const trip of tripsToFix) {
      const checkoutDate = new Date(trip.planned_date).toISOString().split('T')[0];

      // Find completed trip_log for this vehicle and date
      const { data: completedTripLogs, error: logError } = await supabase
        .from('trip_logs')
        .select('id, driver_id, odometer_start, odometer_end, checkout_time, checkin_time, status, delivery_trip_id')
        .eq('vehicle_id', trip.vehicle_id)
        .eq('status', 'checked_in')
        .gte('checkout_time', `${checkoutDate}T00:00:00`)
        .lt('checkout_time', `${checkoutDate}T23:59:59`)
        .order('checkin_time', { ascending: false })
        .limit(1);

      if (logError) {
        console.error(`[deliveryTripService] Error fetching trip_logs for trip ${trip.trip_number}:`, logError);
        continue;
      }

      if (completedTripLogs && completedTripLogs.length > 0) {
        const tripLog = completedTripLogs[0];

        // Update delivery trip to completed
        const updateData: DeliveryTripUpdate = {
          status: 'completed',
          odometer_end: tripLog.odometer_end || trip.odometer_end,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        };

        // Update driver_id if different from planned driver
        if (tripLog.driver_id && trip.driver_id !== tripLog.driver_id) {
          updateData.driver_id = tripLog.driver_id;
        }

        // Update odometer_start if not set
        if (!trip.odometer_start && tripLog.odometer_start) {
          updateData.odometer_start = tripLog.odometer_start;
        }

        const { error: updateError } = await supabase
          .from('delivery_trips')
          .update(updateData)
          .eq('id', trip.id);

        if (updateError) {
          console.error(`[deliveryTripService] Error updating trip ${trip.trip_number}:`, updateError);
          continue;
        }

        // Link trip_log to delivery_trip if not already linked
        if (!tripLog.delivery_trip_id || tripLog.delivery_trip_id !== trip.id) {
          const { error: linkError } = await supabase
            .from('trip_logs')
            .update({ delivery_trip_id: trip.id })
            .eq('id', tripLog.id);

          if (linkError) {
            console.error(`[deliveryTripService] Error linking trip_log to delivery_trip:`, linkError);
          }
        }

        // Update all stores' delivery_status to 'delivered'
        const { error: storesUpdateError } = await supabase
          .from('delivery_trip_stores')
          .update({
            delivery_status: 'delivered',
            delivered_at: tripLog.checkin_time || new Date().toISOString(),
          })
          .eq('delivery_trip_id', trip.id)
          .neq('delivery_status', 'delivered');

        if (storesUpdateError) {
          console.error(`[deliveryTripService] Error updating store delivery status:`, storesUpdateError);
        }

        updatedTrips.push({
          trip_id: trip.id,
          trip_number: trip.trip_number || 'N/A',
          old_status: trip.status,
          new_status: 'completed',
        });

        console.log(`[deliveryTripService] Updated trip ${trip.trip_number} from ${trip.status} to completed`);
      }
    }

    return {
      updated: updatedTrips.length,
      details: updatedTrips,
    };
  },

};

