// Delivery Trip Service - CRUD operations for delivery trips
import { supabase } from '../lib/supabase';
import { withRetry } from '../lib/retry';
import type { Database } from '../types/database';

type DeliveryTrip = Database['public']['Tables']['delivery_trips']['Row'];
type DeliveryTripInsert = Database['public']['Tables']['delivery_trips']['Insert'];
type DeliveryTripUpdate = Database['public']['Tables']['delivery_trips']['Update'];
// Define DeliveryTripStore interface manually (database types may not be up to date)
interface DeliveryTripStore {
  id: string;
  delivery_trip_id: string;
  store_id: string;
  sequence_order: number;
  delivery_status?: string;
  delivered_at?: string;
  created_at?: string;
  updated_at?: string;
}
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
  /** สถานะออเดอร์ที่ผูกกับทริปนี้ (partial/assigned = ส่งบางส่วน มีของค้างส่ง) — ใช้ในหน้าออกบิลฝ่ายขาย */
  order_status?: string;
}

export interface DeliveryTripItemWithProduct extends DeliveryTripItem {
  product?: {
    id: string;
    category: string;
    product_code: string;
    product_name: string;
    unit: string;
    weight_kg?: number | null;
  };
  /** Effective quantity to deliver = quantity - quantity_picked_up_at_store */
  quantity_to_deliver: number;
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
  driver_staff_id?: string; // Service staff ID for driver (crew/commission system)
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
      quantity_picked_up_at_store?: number;
      notes?: string;
      is_bonus?: boolean;
      selected_pallet_config_id?: string; // Phase 0: User-selected pallet config
    }>;
  }>;
}

export interface UpdateDeliveryTripData {
  vehicle_id?: string;
  driver_id?: string;
  driver_staff_id?: string; // Service staff ID for driver (crew/commission system)
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
      quantity_picked_up_at_store?: number;
      notes?: string;
      is_bonus?: boolean;
      selected_pallet_config_id?: string; // Phase 0: User-selected pallet config
    }>;
  }>;
  helpers?: string[]; // Array of service_staff IDs to add as helpers
  // Required reason when editing trip data
  edit_reason?: string;
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
    branch?: string; // Filter by branch: 'HQ' (สำนักงานใหญ่), 'SD' (สอยดาว), or omit for all
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
    search?: string; // Search term for trip_number, notes
    branch?: string; // Filter by branch: 'HQ' (สำนักงานใหญ่), 'SD' (สอยดาว), or 'ALL' (default shows all)
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
          ? 'id, trip_number, status, planned_date, vehicle_id, driver_id, has_item_changes, odometer_start, notes, sequence_order, created_at, actual_pallets_used'
          : '*',
          { count: 'exact' }
        )
        .order('planned_date', { ascending: sortAscending })
        .order('created_at', { ascending: sortAscending })
        .order('sequence_order', { ascending: true });

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

      // Database-level text search
      if (filters?.search) {
        const searchPattern = `%${filters.search}%`;
        // Search in delivery_trips table fields
        query = query.or(
          `trip_number.ilike.${searchPattern},notes.ilike.${searchPattern}`
        );
      }

      // Filter by branch
      if (filters?.branch && filters.branch !== 'ALL') {
        query = query.eq('branch', filters.branch);
      }

      // Apply pagination AFTER all filters
      query = query.range(from, to);

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
      .select('id, delivery_trip_id, store_id, sequence_order, invoice_status, delivery_status') // Include invoice_status and delivery_status
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
    let itemsMap = new Map<string, DeliveryTripItemWithProduct[]>(); // Map: trip_store_id -> items[]
    // order_status ต่อ (delivery_trip_id, store_id) — สำหรับหน้าออกบิลฝ่ายขาย แสดง "ส่งบางส่วน/มีของค้างส่ง"
    const orderStatusByTripStore = new Map<string, string>();

    // In FULL mode only, fetch detailed store info and items
    if (!lite) {
      const storeIds = [...new Set((tripStores || []).map(ts => ts.store_id).filter(Boolean))];
      const { data: stores } = storeIds.length > 0 ? await supabase
        .from('stores')
        .select('id, customer_code, customer_name, address, phone')
        .in('id', storeIds) : { data: [] };

      storeMap = new Map((stores || []).map(s => [s.id, s]));

      // Fetch items for all trip stores
      // Note: tripStores has 'id' field (which is delivery_trip_stores.id) and 'delivery_trip_store_id' alias
      // We need to use the actual 'id' field from delivery_trip_stores table
      const tripStoreIds = (tripStores || []).map(ts => {
        // ts.id is the delivery_trip_stores.id (the primary key)
        // ts.delivery_trip_store_id is an alias for ts.id (from the select statement)
        return ts.id || (ts as any).delivery_trip_store_id;
      }).filter(Boolean) as string[];

      if (tripStoreIds.length > 0) {
        const { data: tripItems, error: itemsError } = await supabase
          .from('delivery_trip_items')
          .select('id, delivery_trip_store_id, product_id, quantity, quantity_picked_up_at_store, notes, is_bonus')
          .in('delivery_trip_store_id', tripStoreIds);

        if (itemsError) {
          console.error('[deliveryTripService] Error fetching trip items:', itemsError, {
            tripStoreIds,
            tripStoreIdsLength: tripStoreIds.length,
            sampleTripStore: tripStores[0],
          });
          // Don't throw - continue without items to avoid breaking the whole query
        }

        // Fetch products
        if (tripItems && tripItems.length > 0) {
          const productIds = [...new Set(tripItems.map(item => item.product_id).filter(Boolean))];
          const { data: products } = productIds.length > 0 ? await supabase
            .from('products')
            .select('id, product_code, product_name, category, unit, base_price')
            .in('id', productIds) : { data: [] };

          const productMap = new Map((products || []).map(p => [p.id, p]));

          // Group items by trip_store_id
          (tripItems || []).forEach(item => {
            if (!itemsMap.has(item.delivery_trip_store_id)) {
              itemsMap.set(item.delivery_trip_store_id, []);
            }
            const pickedUp = Number((item as any).quantity_picked_up_at_store ?? 0);
            itemsMap.get(item.delivery_trip_store_id)!.push({
              ...item,
              product: productMap.get(item.product_id),
              quantity_to_deliver: Number(item.quantity) - pickedUp,
            });
          });
        }
      }
    }

    // Fetch crews for trips (lite mode: basic info for status display, full mode: complete details)
    let tripCrewsMap = new Map<string, DeliveryTripCrewWithDetails[]>();
    if (tripIds.length > 0) {
      const { data: tripCrews } = await supabase
        .from('delivery_trip_crews')
        .select(lite ? 'id, delivery_trip_id, staff_id, role, status' : '*')
        .in('delivery_trip_id', tripIds)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      // Fetch service staff for crews
      if (tripCrews && tripCrews.length > 0) {
        const crewStaffIds = [...new Set(tripCrews.map(c => c.staff_id).filter(Boolean))];
        const { data: staffList } = crewStaffIds.length > 0 ? await supabase
          .from('service_staff')
          .select('id, name, employee_code, phone')
          .in('id', crewStaffIds) : { data: [] };

        const staffMap = new Map((staffList || []).map(s => [s.id, s]));

        // Group by trip_id
        tripCrews.forEach(crew => {
          if (!tripCrewsMap.has(crew.delivery_trip_id)) {
            tripCrewsMap.set(crew.delivery_trip_id, []);
          }
          tripCrewsMap.get(crew.delivery_trip_id)!.push({
            ...crew,
            staff: staffMap.get(crew.staff_id),
          });
        });
      }
    }

    // Combine data
    const combinedTrips = trips.map(trip => {
      const tripStoresForTrip = tripStoresMap.get(trip.id) || [];
      const storesWithDetails: DeliveryTripStoreWithDetails[] = tripStoresForTrip.map(ts => {
        // ts.id is the delivery_trip_stores.id (primary key)
        const tripStoreId = ts.id || (ts as any).delivery_trip_store_id;
        const orderStatus = !lite ? orderStatusByTripStore.get(`${trip.id}_${ts.store_id}`) : undefined;
        return {
          ...ts,
          // In lite mode, store detail will be undefined, which is fine for list view specific needs
          // The list view primarily checks `stores.length`
          store: storeMap.get(ts.store_id),
          // Add items if in full mode - use tripStoreId to lookup items
          items: !lite ? (itemsMap.get(tripStoreId) || []) : undefined,
          // สำหรับหน้าออกบิลฝ่ายขาย: แสดง "ส่งบางส่วน มีของค้างส่ง" เมื่อ order_status เป็น partial หรือ assigned
          order_status: orderStatus,
        };
      });

      return {
        ...trip,
        vehicle: vehicleMap.get(trip.vehicle_id),
        driver: driverMap.get(trip.driver_id),
        stores: storesWithDetails,
        crews: tripCrewsMap.get(trip.id) || [],
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
        .select('id, category, product_code, product_name, unit, weight_kg')
        .in('id', productIds) : { data: [] };

      const productMap = new Map((products || []).map(p => [p.id, p]));

      items = (tripItems || []).map(item => ({
        ...item,
        product: productMap.get(item.product_id),
        quantity_to_deliver: Number(item.quantity) - Number((item as any).quantity_picked_up_at_store ?? 0),
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

    // ดึงสาขาของรถเพื่อใส่ในทริป (ให้ทริปแสดงในรายการเมื่อกรองตามสาขา เช่น สำนักงานใหญ่ HQ / สอยดาว SD)
    let vehicleBranch: string | null = null;
    const { data: vehicleRow } = await supabase
      .from('vehicles')
      .select('branch')
      .eq('id', data.vehicle_id)
      .single();
    if (vehicleRow?.branch) {
      vehicleBranch = vehicleRow.branch;
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
      branch: vehicleBranch,
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
        // Priority 1: Use explicit driver_staff_id if provided (from crew assignment UI)
        if (data.driver_staff_id) {
          const now = new Date().toISOString();
          const { error: insertDriverCrewError } = await supabase
            .from('delivery_trip_crews')
            .insert({
              delivery_trip_id: trip.id,
              staff_id: data.driver_staff_id,
              role: 'driver',
              status: 'active',
              start_at: now,
              created_by: user.id,
              updated_by: user.id,
            });

          if (insertDriverCrewError) {
            console.error('[deliveryTripService] Error creating driver crew from driver_staff_id:', insertDriverCrewError);
          } else {
            console.log('[deliveryTripService] Created driver crew from explicit driver_staff_id:', {
              trip_id: trip.id,
              staff_id: data.driver_staff_id,
            });
          }
        }
        // Priority 2: Fallback to name-matching from profiles (legacy behavior)
        else if (trip.driver_id) {
          const { data: driverProfile } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', trip.driver_id)
            .single();

          if (driverProfile?.full_name) {
            const driverName = driverProfile.full_name.trim();

            let { data: staffMatches, error: staffError } = await supabase
              .from('service_staff')
              .select('id, name, status')
              .eq('name', driverName)
              .limit(5);

            if (!staffError && (!staffMatches || staffMatches.length === 0)) {
              const { data: caseInsensitiveMatches, error: caseError } = await supabase
                .from('service_staff')
                .select('id, name, status')
                .ilike('name', driverName)
                .limit(5);

              if (!caseError && caseInsensitiveMatches && caseInsensitiveMatches.length > 0) {
                staffMatches = caseInsensitiveMatches;
              }
            }

            if (staffError) {
              console.error('[deliveryTripService] Error matching driver to service_staff:', staffError);
            } else if (staffMatches && staffMatches.length > 0) {
              const staff = staffMatches.find(s => s.status === 'active') || staffMatches[0];
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
                  console.error('[deliveryTripService] Error creating driver crew from name match:', insertDriverCrewError);
                }
              }
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
    // Check for duplicate stores before inserting
    const storeIds = new Set<string>();
    for (const storeData of data.stores) {
      if (storeIds.has(storeData.store_id)) {
        throw new Error(`ร้านค้าซ้ำกันในรายการ: store_id ${storeData.store_id} ปรากฏมากกว่า 1 ครั้ง`);
      }
      storeIds.add(storeData.store_id);
    }

    for (const storeData of data.stores) {
      // Check if store already exists in this trip (defensive check)
      const { data: existingStore } = await supabase
        .from('delivery_trip_stores')
        .select('id')
        .eq('delivery_trip_id', trip.id)
        .eq('store_id', storeData.store_id)
        .maybeSingle();

      if (existingStore) {
        console.warn('[deliveryTripService] Store already exists in trip, skipping:', {
          trip_id: trip.id,
          store_id: storeData.store_id,
        });
        // Use existing store instead of creating new one
        const tripStore = existingStore;

        // Still create items for this store
        if (storeData.items && storeData.items.length > 0) {
          const itemsData = storeData.items.map(item => ({
            delivery_trip_id: trip.id,
            delivery_trip_store_id: tripStore.id,
            product_id: item.product_id,
            quantity: item.quantity,
            quantity_picked_up_at_store: item.quantity_picked_up_at_store ?? 0,
            notes: item.notes,
            is_bonus: item.is_bonus || false,
            selected_pallet_config_id: item.selected_pallet_config_id || null,
          }));

          const { error: itemsError } = await supabase
            .from('delivery_trip_items')
            .insert(itemsData);

          if (itemsError) {
            console.error('[deliveryTripService] Error creating trip items:', itemsError);
            throw itemsError;
          }
        }
        continue;
      }

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
        // Provide more helpful error message for 409 conflict
        if (storeError.code === '23505' || storeError.message?.includes('duplicate') || storeError.message?.includes('unique')) {
          throw new Error(`ไม่สามารถเพิ่มร้านค้านี้ได้: ร้านค้านี้มีอยู่ในทริปนี้แล้ว (store_id: ${storeData.store_id})`);
        }
        throw storeError;
      }

      // Create trip items for this store
      if (storeData.items && storeData.items.length > 0) {
        const itemsData = storeData.items.map(item => ({
          delivery_trip_id: trip.id,
          delivery_trip_store_id: tripStore.id,
          product_id: item.product_id,
          quantity: item.quantity,
          quantity_picked_up_at_store: item.quantity_picked_up_at_store ?? 0,
          notes: item.notes,
          is_bonus: item.is_bonus || false,
          selected_pallet_config_id: item.selected_pallet_config_id || null,
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

    // Validate edit_reason if this is a data edit (not just status change)
    const isDataEdit = data.vehicle_id || data.driver_id || data.planned_date ||
      data.odometer_start !== undefined || data.notes !== undefined ||
      data.stores || data.helpers;

    if (isDataEdit && (!data.edit_reason || !data.edit_reason.trim())) {
      throw new Error('กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป');
    }

    // Get current trip data for audit log
    const { data: currentTrip, error: fetchError } = await supabase
      .from('delivery_trips')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('[deliveryTripService] Error fetching current trip:', fetchError);
      throw fetchError;
    }

    // Extract relation data & reason from input (not direct columns)
    const stores = data.stores;
    const changeReason = data.change_reason;
    const editReason = data.edit_reason;
    let itemChangesOccurred = false;

    // Update trip basic info (exclude stores/change_reason/edit_reason - they are not columns)
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

    // ถ้าเปลี่ยน vehicle_id ให้ดึง branch ของรถใหม่มาใส่ด้วย (ให้ทริปแสดงในรายการตามสาขา)
    if (data.vehicle_id != null) {
      const { data: vehicleRow } = await supabase
        .from('vehicles')
        .select('branch')
        .eq('id', data.vehicle_id)
        .single();
      if (vehicleRow?.branch != null) {
        updateData.branch = vehicleRow.branch;
      }
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof DeliveryTripUpdate] === undefined) {
        delete updateData[key as keyof DeliveryTripUpdate];
      }
    });

    // Explicitly ensure relation-only fields are not in updateData
    delete (updateData as any).stores;
    delete (updateData as any).change_reason;
    delete (updateData as any).edit_reason;

    // Prepare old and new values for audit log
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    // Track which fields are being changed
    const fieldsToTrack = ['vehicle_id', 'driver_id', 'planned_date', 'odometer_start', 'odometer_end', 'status', 'notes', 'sequence_order'];
    fieldsToTrack.forEach(field => {
      if (field in updateData && updateData[field as keyof typeof updateData] !== undefined) {
        oldValues[field] = currentTrip[field as keyof typeof currentTrip];
        newValues[field] = updateData[field as keyof typeof updateData];
      }
    });

    // Add edit_reason to updateData if provided
    if (editReason) {
      (updateData as any).edit_reason = editReason;
    }

    const { error: updateError } = await supabase
      .from('delivery_trips')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[deliveryTripService] Error updating trip:', updateError);
      throw updateError;
    }

    // Save audit log if edit_reason was provided
    if (editReason && Object.keys(oldValues).length > 0) {
      try {
        const { error: auditError } = await supabase
          .from('trip_edit_history')
          .insert({
            trip_log_id: null,
            delivery_trip_id: id,
            edited_by: user.id,
            edit_reason: editReason,
            changes: {
              old_values: oldValues,
              new_values: newValues,
            },
            edited_at: new Date().toISOString(),
          });

        if (auditError) {
          console.error('[deliveryTripService] Error saving audit log:', auditError);
          // Don't throw - audit log failure shouldn't block the update
        }
      } catch (auditError) {
        console.error('[deliveryTripService] Error saving audit log:', auditError);
      }
    }

    // Handle helpers (crew) assignment if provided
    if (data.helpers !== undefined) {
      // Get existing active crews
      const { data: existingCrews, error: existingCrewsError } = await supabase
        .from('delivery_trip_crews')
        .select('id, staff_id, role, status')
        .eq('delivery_trip_id', id)
        .eq('status', 'active');

      if (existingCrewsError) {
        console.error('[deliveryTripService] Error loading existing crews:', existingCrewsError);
        // Don't throw - continue without crews
      }

      const existingHelperIds = (existingCrews || [])
        .filter(c => c.role === 'helper')
        .map(c => c.staff_id);

      // Find helpers to add (not in existing list)
      const helpersToAdd = data.helpers.filter(helperId => !existingHelperIds.includes(helperId));

      // Find helpers to remove (in existing list but not in new list)
      const helpersToRemove = existingHelperIds.filter(helperId => !data.helpers!.includes(helperId));

      // Add new helpers
      if (helpersToAdd.length > 0) {
        const crewData = helpersToAdd.map(staffId => ({
          delivery_trip_id: id,
          staff_id: staffId,
          role: 'helper' as const,
          status: 'active' as const,
          start_at: new Date().toISOString(),
          created_by: user.id,
          updated_by: user.id,
        }));

        const { error: crewError } = await supabase
          .from('delivery_trip_crews')
          .insert(crewData);

        if (crewError) {
          console.error('[deliveryTripService] Error adding helpers:', crewError);
          // Don't throw - allow trip update to continue
          // But log the error for debugging
        } else {
          console.log('[deliveryTripService] Successfully added helpers:', helpersToAdd);
        }
      }

      // Remove helpers that are no longer in the list
      if (helpersToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('delivery_trip_crews')
          .update({
            status: 'removed',
            end_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('delivery_trip_id', id)
          .in('staff_id', helpersToRemove)
          .eq('role', 'helper')
          .eq('status', 'active');

        if (removeError) {
          console.error('[deliveryTripService] Error removing helpers:', removeError);
          // Don't throw - allow trip update to continue
        } else {
          console.log('[deliveryTripService] Successfully removed helpers:', helpersToRemove);
        }
      }
    }

    // Handle driver_staff_id update if provided
    if (data.driver_staff_id) {
      try {
        // Check current driver crew
        const { data: existingDriverCrews } = await supabase
          .from('delivery_trip_crews')
          .select('id, staff_id')
          .eq('delivery_trip_id', id)
          .eq('role', 'driver')
          .eq('status', 'active')
          .limit(1);

        const currentDriverCrew = existingDriverCrews?.[0];

        if (currentDriverCrew && currentDriverCrew.staff_id !== data.driver_staff_id) {
          // Swap driver: mark old as replaced, add new
          const now = new Date().toISOString();
          await supabase
            .from('delivery_trip_crews')
            .update({
              status: 'replaced',
              end_at: now,
              replaced_by_staff_id: data.driver_staff_id,
              reason_for_change: editReason || 'เปลี่ยนคนขับจากหน้าแก้ไขทริป',
              updated_by: user.id,
            })
            .eq('id', currentDriverCrew.id);

          await supabase
            .from('delivery_trip_crews')
            .insert({
              delivery_trip_id: id,
              staff_id: data.driver_staff_id,
              role: 'driver',
              status: 'active',
              start_at: now,
              created_by: user.id,
              updated_by: user.id,
            });
        } else if (!currentDriverCrew) {
          // No driver crew yet, add new one
          await supabase
            .from('delivery_trip_crews')
            .insert({
              delivery_trip_id: id,
              staff_id: data.driver_staff_id,
              role: 'driver',
              status: 'active',
              start_at: new Date().toISOString(),
              created_by: user.id,
              updated_by: user.id,
            });
        }
        // If same driver, do nothing
      } catch (driverCrewError) {
        console.error('[deliveryTripService] Error updating driver crew:', driverCrewError);
        // Don't throw - allow trip update to continue
      }
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
        .select('id, delivery_trip_store_id, product_id, quantity, notes, is_bonus, selected_pallet_config_id')
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
            action: action, // Use 'action' column name to match database schema
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
      const storesToRemove = (existingStores || []).filter(s => !newStoresByStoreId.has(s.store_id));
      const storeIdsToRemove = storesToRemove.map(s => s.id);
      const storeIdsToUnassign = storesToRemove.map((s: any) => s.store_id);

      if (storeIdsToRemove.length > 0) {
        // ยกเลิกการผูกทริปและล้างรหัสออเดอร์สำหรับออเดอร์ของร้านที่ถูกลบออกจากทริป
        if (storeIdsToUnassign.length > 0) {
          const { data: ordersToReset } = await supabase
            .from('orders')
            .select('id')
            .eq('delivery_trip_id', id)
            .in('store_id', storeIdsToUnassign);

          if (ordersToReset && ordersToReset.length > 0) {
            const orderIdsToReset = ordersToReset.map(o => o.id);
            const { error: resetOrdersError } = await supabase
              .from('orders')
              .update({
                delivery_trip_id: null,
                order_number: null,
                status: 'confirmed',
                updated_by: user.id,
              })
              .in('id', orderIdsToReset);

            if (resetOrdersError) {
              console.error('[deliveryTripService] Error resetting orders for removed stores:', resetOrdersError);
              throw resetOrdersError;
            }
          }
        }

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
          quantity_picked_up_at_store?: number;
          notes?: string | null;
          is_bonus: boolean;
          selected_pallet_config_id?: string | null;
        };

        const existingItemsForStore: TripItemRow[] = existingStore
          ? ((existingItemsByStore.get(existingStore.id) || []) as TripItemRow[])
          : [];

        const existingItemsMap = new Map<string, TripItemRow>(
          existingItemsForStore.map(item => [`${item.product_id}-${item.is_bonus || false}`, item])
        );

        const newItemsMap = new Map<string, { product_id: string; quantity: number; quantity_picked_up_at_store?: number; notes?: string; is_bonus: boolean }>();
        for (const item of storeData.items || []) {
          newItemsMap.set(`${item.product_id}-${item.is_bonus || false}`, {
            product_id: item.product_id,
            quantity: item.quantity,
            quantity_picked_up_at_store: item.quantity_picked_up_at_store,
            notes: item.notes,
            is_bonus: item.is_bonus || false,
          });
        }

        // Remove items that are not in new list
        const itemsToRemove = existingItemsForStore.filter(
          item => !newItemsMap.has(`${item.product_id}-${item.is_bonus || false}`)
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
          const existingItem = existingItemsMap.get(`${item.product_id}-${item.is_bonus || false}`);

          if (!existingItem) {
            // New item
            const { data: insertedItems, error: insertItemError } = await supabase
              .from('delivery_trip_items')
              .insert({
                delivery_trip_id: id,
                delivery_trip_store_id: tripStoreId,
                product_id: item.product_id,
                quantity: item.quantity,
                quantity_picked_up_at_store: item.quantity_picked_up_at_store ?? 0,
                notes: item.notes,
                is_bonus: item.is_bonus || false,
                selected_pallet_config_id: item.selected_pallet_config_id || null,
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
            const oldPickedUp = Number(existingItem.quantity_picked_up_at_store ?? 0);
            const newPickedUp = item.quantity_picked_up_at_store !== undefined
              ? Number(item.quantity_picked_up_at_store)
              : oldPickedUp;

            const needsUpdate = oldQty !== newQty ||
              oldPickedUp !== newPickedUp ||
              (item.notes !== undefined) ||
              (item.selected_pallet_config_id !== undefined &&
                item.selected_pallet_config_id !== (existingItem as any).selected_pallet_config_id);

            if (needsUpdate) {
              const { error: updateItemError } = await supabase
                .from('delivery_trip_items')
                .update({
                  quantity: item.quantity,
                  quantity_picked_up_at_store: newPickedUp,
                  notes: item.notes,
                  selected_pallet_config_id: item.selected_pallet_config_id || null,
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // 1. หาออเดอร์ทั้งหมดที่เชื่อมกับทริปนี้
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('delivery_trip_id', id);

    if (ordersError) {
      console.error('[deliveryTripService] Error fetching orders:', ordersError);
      throw ordersError;
    }

    // 2. อัพเดทออเดอร์ทั้งหมดกลับเป็น 'confirmed' และตั้ง delivery_trip_id และ order_number เป็น null
    //    เพื่อให้สามารถสร้างทริปใหม่และสร้าง order_number ใหม่ได้
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const { error: updateOrdersError } = await supabase
        .from('orders')
        .update({
          delivery_trip_id: null,
          order_number: null, // Clear order_number so it can be regenerated for new trip
          status: 'confirmed',
          updated_by: user.id,
        })
        .in('id', orderIds);

      if (updateOrdersError) {
        console.error('[deliveryTripService] Error updating orders:', updateOrdersError);
        throw updateOrdersError;
      }

      // 3. รีเซ็ต quantity_delivered เป็น 0 ก่อน (ออเดอร์ที่ลบทริป = ยังไม่มีส่วนใดถูกจัดส่ง)
      const { error: resetDeliveredError } = await supabase
        .from('order_items')
        .update({
          quantity_delivered: 0,
          updated_at: new Date().toISOString(),
        })
        .in('order_id', orderIds);

      if (resetDeliveredError) {
        console.error('[deliveryTripService] Error resetting quantity_delivered:', resetDeliveredError);
        throw resetDeliveredError;
      }

      // 4. คำนวณ quantity_delivered ใหม่จากทริป completed อื่น (ถ้ามี) ที่ส่งให้ร้านเหล่านี้
      //    หมายเหตุ: ไม่รีเซ็ต quantity_picked_up_at_store — เป็นข้อมูลฝ่ายขายว่าลูกค้ารับที่ร้านแล้ว
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, quantity')
        .in('order_id', orderIds);

      const { data: ordersWithStore } = await supabase
        .from('orders')
        .select('id, store_id')
        .in('id', orderIds);

      if (itemsError || !ordersWithStore) {
        console.error('[deliveryTripService] Error fetching data for recalculating quantity_delivered:', itemsError);
        // Don't throw - เรารีเซ็ตเป็น 0 แล้ว ต่อให้ recalc ไม่สำเร็จก็ใช้ 0 ได้
      } else if (orderItems && orderItems.length > 0) {
        const storeIdByOrderId = new Map(ordersWithStore.map((o: any) => [o.id, o.store_id]));

        // ดึงข้อมูล completed trips ที่ส่งให้ร้านเหล่านี้ (ไม่รวมทริปที่กำลังจะลบ)
        const storeIds = [...new Set(ordersWithStore.map((o: any) => o.store_id).filter(Boolean))];

        // ดึง completed trip IDs — ไม่รวมทริปนี้ (id) เพราะกำลังจะลบ
        const { data: completedTrips } = await supabase
          .from('delivery_trips')
          .select('id')
          .eq('status', 'completed')
          .neq('id', id);

        const completedTripIds = completedTrips ? completedTrips.map((t: any) => t.id) : [];

        // ดึง delivery_trip_stores ของ completed trips ที่ส่งให้ร้านเหล่านี้
        const { data: completedTripStores } = completedTripIds.length > 0 && storeIds.length > 0
          ? await supabase
            .from('delivery_trip_stores')
            .select('id, store_id, delivery_trip_id')
            .in('store_id', storeIds)
            .in('delivery_trip_id', completedTripIds)
          : { data: [] };

        if (completedTripStores && completedTripStores.length > 0) {
          const tripStoreIds = completedTripStores.map((ts: any) => ts.id);

          // ดึง delivery_trip_items ของ completed trips (ใช้ quantity - quantity_picked_up_at_store = จำนวนที่จัดส่งจริง)
          const { data: tripItems } = await supabase
            .from('delivery_trip_items')
            .select('delivery_trip_store_id, product_id, quantity, quantity_picked_up_at_store')
            .in('delivery_trip_store_id', tripStoreIds);

          // คำนวณ quantity_delivered ต่อ (store_id, product_id)
          const deliveredByStoreProduct = new Map<string, number>();
          if (tripItems) {
            tripItems.forEach((ti: any) => {
              const tripStore = completedTripStores.find((ts: any) => ts.id === ti.delivery_trip_store_id);
              if (tripStore) {
                const key = `${tripStore.store_id}_${ti.product_id}`;
                const pickedUp = Number(ti.quantity_picked_up_at_store ?? 0);
                const delivered = Math.max(0, Number(ti.quantity || 0) - pickedUp);
                const current = deliveredByStoreProduct.get(key) || 0;
                deliveredByStoreProduct.set(key, current + delivered);
              }
            });
          }

          // อัปเดต quantity_delivered สำหรับแต่ละ order_item
          for (const item of orderItems) {
            const storeId = storeIdByOrderId.get(item.order_id);
            if (!storeId) continue;

            const key = `${storeId}_${item.product_id}`;
            const totalDelivered = deliveredByStoreProduct.get(key) || 0;

            // อัปเดต quantity_delivered (ไม่เกิน quantity ที่สั่ง)
            await supabase
              .from('order_items')
              .update({
                quantity_delivered: Math.min(totalDelivered, Number(item.quantity || 0)),
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);
          }
        } else {
          // ถ้าไม่มี completed trips ที่ส่งให้ร้านเหล่านี้ ให้รีเซ็ต quantity_delivered เป็น 0
          await supabase
            .from('order_items')
            .update({
              quantity_delivered: 0,
              updated_at: new Date().toISOString(),
            })
            .in('id', orderItems.map((item: any) => item.id));
        }
      }

      console.log(`[deliveryTripService] Reset ${orderIds.length} orders (cleared delivery_trip_id, order_number, recalculated quantity_delivered)`);
    }

    // 5. ลบทริป (CASCADE จะลบข้อมูลที่เกี่ยวข้องอัตโนมัติ)
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

    // Reset orders: clear delivery_trip_id and order_number so they can be reassigned to a new trip
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('delivery_trip_id', id);

    if (ordersError) {
      console.error('[deliveryTripService] Error fetching orders:', ordersError);
      // Don't throw - trip is already cancelled, just log the error
    } else if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const { error: updateOrdersError } = await supabase
        .from('orders')
        .update({
          delivery_trip_id: null,
          order_number: null, // Clear order_number so it can be regenerated for new trip
          status: 'confirmed',
          updated_by: user.id,
        })
        .in('id', orderIds);

      if (updateOrdersError) {
        console.error('[deliveryTripService] Error resetting orders:', updateOrdersError);
        // Don't throw - trip is already cancelled, just log the error
      } else {
        // รีเซ็ต quantity_delivered เป็น 0 ก่อน (ออเดอร์ที่ยกเลิกทริป = ยังไม่มีส่วนใดถูกจัดส่งจากทริปนี้)
        await supabase
          .from('order_items')
          .update({
            quantity_delivered: 0,
            updated_at: new Date().toISOString(),
          })
          .in('order_id', orderIds);

        // คำนวณ quantity_delivered ใหม่จากทริปที่ยังมีอยู่จริง (completed trips)
        // ไม่รีเซ็ต quantity_picked_up_at_store — เป็นข้อมูลฝ่ายขายว่าลูกค้ารับที่ร้านแล้ว
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('id, order_id, product_id, quantity')
          .in('order_id', orderIds);

        const { data: ordersWithStore } = await supabase
          .from('orders')
          .select('id, store_id')
          .in('id', orderIds);

        if (orderItems && ordersWithStore && orderItems.length > 0) {
          const storeIdByOrderId = new Map(ordersWithStore.map((o: any) => [o.id, o.store_id]));
          const storeIds = [...new Set(ordersWithStore.map((o: any) => o.store_id).filter(Boolean))];

          // ดึง completed trip IDs (ไม่รวมทริปนี้ที่ถูกยกเลิก)
          const { data: completedTrips } = await supabase
            .from('delivery_trips')
            .select('id')
            .eq('status', 'completed')
            .neq('id', id);

          const completedTripIds = completedTrips ? completedTrips.map((t: any) => t.id) : [];

          // ดึง delivery_trip_stores ของ completed trips
          const { data: completedTripStores } = completedTripIds.length > 0 && storeIds.length > 0
            ? await supabase
              .from('delivery_trip_stores')
              .select('id, store_id, delivery_trip_id')
              .in('store_id', storeIds)
              .in('delivery_trip_id', completedTripIds)
            : { data: [] };

          if (completedTripStores && completedTripStores.length > 0) {
            const tripStoreIds = completedTripStores.map((ts: any) => ts.id);
            const { data: tripItems } = await supabase
              .from('delivery_trip_items')
              .select('delivery_trip_store_id, product_id, quantity, quantity_picked_up_at_store')
              .in('delivery_trip_store_id', tripStoreIds);

            const deliveredByStoreProduct = new Map<string, number>();
            if (tripItems) {
              tripItems.forEach((ti: any) => {
                const tripStore = completedTripStores.find((ts: any) => ts.id === ti.delivery_trip_store_id);
                if (tripStore) {
                  const key = `${tripStore.store_id}_${ti.product_id}`;
                  const pickedUp = Number(ti.quantity_picked_up_at_store ?? 0);
                  const delivered = Math.max(0, Number(ti.quantity || 0) - pickedUp);
                  const current = deliveredByStoreProduct.get(key) || 0;
                  deliveredByStoreProduct.set(key, current + delivered);
                }
              });
            }

            for (const item of orderItems) {
              const storeId = storeIdByOrderId.get(item.order_id);
              if (!storeId) continue;
              const key = `${storeId}_${item.product_id}`;
              const totalDelivered = deliveredByStoreProduct.get(key) || 0;
              await supabase
                .from('order_items')
                .update({
                  quantity_delivered: Math.min(totalDelivered, Number(item.quantity || 0)),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);
            }
          } else {
            // ถ้าไม่มี completed trips ให้รีเซ็ต quantity_delivered เป็น 0
            await supabase
              .from('order_items')
              .update({
                quantity_delivered: 0,
                updated_at: new Date().toISOString(),
              })
              .in('id', orderItems.map((item: any) => item.id));
          }
        }

        console.log(`[deliveryTripService] Reset ${orderIds.length} orders (cleared delivery_trip_id, order_number, recalculated quantity_delivered)`);
      }
    }

    // Return updated trip
    const updatedTrip = await deliveryTripService.getById(id);
    if (!updatedTrip) {
      console.error('[deliveryTripService] Failed to retrieve cancelled trip');
      throw new Error('ไม่สามารถดึงข้อมูลทริปที่ยกเลิกแล้วได้');
    }

    console.log('[deliveryTripService] Cancel completed successfully');
    return updatedTrip;
  },

  // Update store invoice status
  updateStoreInvoiceStatus: async (
    tripId: string,
    storeId: string,
    status: 'pending' | 'issued'
  ): Promise<void> => {
    // We need to find the delivery_trip_store record first
    const { data: tripStore, error: findError } = await supabase
      .from('delivery_trip_stores')
      .select('id')
      .eq('delivery_trip_id', tripId)
      .eq('store_id', storeId)
      .single();

    if (findError) throw findError;

    const { error } = await supabase
      .from('delivery_trip_stores')
      .update({ invoice_status: status })
      .eq('id', tripStore.id);

    if (error) throw error;
  },

  // Update quantity_picked_up_at_store for a single trip item
  updatePickedUpQuantity: async (
    itemId: string,
    quantityPickedUp: number
  ): Promise<void> => {
    const { error } = await supabase
      .from('delivery_trip_items')
      .update({ quantity_picked_up_at_store: quantityPickedUp })
      .eq('id', itemId);

    if (error) {
      console.error('[deliveryTripService] Error updating quantity_picked_up_at_store:', error);
      throw error;
    }
  },

  // Get aggregated products for a trip (all products across all stores)
  // total_quantity = effective quantity to deliver (quantity - quantity_picked_up_at_store)
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
    const trip = await deliveryTripService.getById(tripId);
    if (!trip || !trip.stores) {
      return [];
    }

    // Aggregate products across all stores (use quantity_to_deliver for effective load)
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

        const existing = productMap.get(productId);

        if (existing) {
          existing.total_quantity += toDeliver;
          existing.total_picked_up_at_store += pickedUp;
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
            unit: item.product.unit,
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

  // Get delivery trip edit history (audit log)
  getDeliveryTripEditHistory: async (tripId: string): Promise<import('../services/tripLogService').TripEditHistory[]> => {
    const { data, error } = await supabase
      .from('trip_edit_history')
      .select(`
        *,
        editor:profiles!edited_by(full_name, email)
      `)
      .eq('delivery_trip_id', tripId)
      .order('edited_at', { ascending: false });

    if (error) {
      console.error('[deliveryTripService] Error fetching delivery trip edit history:', error);
      throw error;
    }

    return (data || []) as import('../services/tripLogService').TripEditHistory[];
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

    // ดึงสาขาของรถใหม่เพื่ออัปเดต branch ของทริป
    let newVehicleBranch: string | null = null;
    const { data: vehicleRow } = await supabase
      .from('vehicles')
      .select('branch')
      .eq('id', newVehicleId)
      .single();
    if (vehicleRow?.branch) {
      newVehicleBranch = vehicleRow.branch;
    }

    // อัปเดตรถใหม่และสาขา
    const { error: updateError } = await supabase
      .from('delivery_trips')
      .update({
        vehicle_id: newVehicleId,
        branch: newVehicleBranch,
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

  /**
   * ซิงค์ quantity_delivered ใน order_items ตามยอดที่ส่งในทริปที่ completed
   * เรียกใช้ทุกครั้งที่ทริปถูกตั้งเป็น completed (เช็คอิน / sync สถานะ) เพื่อให้ "ส่งแล้ว/คงเหลือ" ตรงเสมอ
   * แม้ DB trigger จะทำอยู่แล้ว การเรียกจากแอปเป็น safety net ป้องกันเคส trigger ไม่รันหรือยังไม่ได้รัน migration
   */
  syncQuantityDeliveredForCompletedTrip: async (tripId: string): Promise<void> => {
    try {
      const { error } = await supabase.rpc('backfill_quantity_delivered_for_trip', {
        p_trip_id: tripId,
      });
      if (error) {
        console.error('[deliveryTripService] syncQuantityDeliveredForCompletedTrip error:', {
          tripId,
          error: error.message,
          code: error.code,
        });
        return;
      }
      console.log('[deliveryTripService] Synced quantity_delivered for completed trip:', tripId);
    } catch (e) {
      console.error('[deliveryTripService] syncQuantityDeliveredForCompletedTrip exception:', tripId, e);
    }
  },

  // Sync delivery trips status with completed trip_logs
  // This fixes delivery trips that should be 'completed' but are still 'planned' or 'in_progress'
  // WARNING: This function links trip_logs to delivery_trips by matching vehicle+date.
  // It will NOT overwrite existing links (trip_logs already linked to other delivery_trips).
  // Use carefully as it may link unrelated usage (เคสนอกทริป) to delivery trips.
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

        // Link trip_log to delivery_trip ONLY if not already linked to avoid overwriting correct links
        // If trip_log already has a different delivery_trip_id, skip linking to prevent conflicts
        if (!tripLog.delivery_trip_id) {
          const { error: linkError } = await supabase
            .from('trip_logs')
            .update({ delivery_trip_id: trip.id })
            .eq('id', tripLog.id);

          if (linkError) {
            console.error(`[deliveryTripService] Error linking trip_log to delivery_trip:`, linkError);
          } else {
            console.log(`[deliveryTripService] Linked trip_log ${tripLog.id} to delivery_trip ${trip.trip_number}`);
          }
        } else if (tripLog.delivery_trip_id !== trip.id) {
          console.warn(`[deliveryTripService] Trip log ${tripLog.id} already linked to different delivery_trip ${tripLog.delivery_trip_id}. Skipping link to avoid conflict.`);
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

        // ซิงค์ quantity_delivered ใน order_items (ส่งแล้ว/คงเหลือ) เหมือนตอนเช็คอิน
        try {
          await deliveryTripService.syncQuantityDeliveredForCompletedTrip(trip.id);
        } catch (syncErr) {
          console.warn('[deliveryTripService] Sync quantity_delivered failed for trip', trip.trip_number, syncErr);
        }
      }
    }

    return {
      updated: updatedTrips.length,
      details: updatedTrips,
    };
  },

  // Get staff item distribution for a trip
  // คำนวณการกระจายสินค้าต่อพนักงานในแต่ละทริป (สำหรับแสดงสถิติ)
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

    return (data || []).map(item => ({
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

  // Get product distribution by trip
  // คำนวณการกระจายสินค้าตามชนิดในแต่ละทริป
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

    return (data || []).map(item => ({
      product_id: item.product_id,
      product_code: item.product_code,
      product_name: item.product_name,
      category: item.category,
      unit: item.unit,
      total_quantity: parseFloat(item.total_quantity || '0'),
      total_staff_count: parseFloat(item.total_staff_count || '0'),
      quantity_per_staff: parseFloat(item.quantity_per_staff || '0'),
      store_count: parseInt(item.store_count || '0', 10),
      stores_detail: (item.stores_detail || []) as Array<{
        store_id: string;
        store_name: string | null;
        store_code: string | null;
        quantity: number;
      }>,
    }));
  },

};

