// Trip CRUD service - getAll, getById, create, update, delete, updatePickedUpQuantity, changeVehicle
import { supabase } from '../../lib/supabase';
import { withRetry } from '../../lib/retry';
import {
  recalculateCompletedTripCommission,
  resolveCrewAssignmentStartAt,
} from './crewCommissionUtils';
import type {
  DeliveryTripWithRelations,
  DeliveryTripStoreWithDetails,
  DeliveryTripItemWithProduct,
  DeliveryTripCrewWithDetails,
  CreateDeliveryTripData,
  UpdateDeliveryTripData,
  DeliveryTripInsert,
  DeliveryTripUpdate,
} from './types';

export const tripCrudService = {
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
    const result = await tripCrudService.getAllWithPagination({
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
      console.error('[tripCrudService] Error fetching delivery trips:', error);
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
          console.error('[tripCrudService] Error fetching trip items:', itemsError, {
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
          .select('id, name, employee_code, phone, user_id')
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
      console.error('[tripCrudService] Error fetching trip:', tripError);

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
      console.error('[tripCrudService] Error fetching trip stores:', storesError);
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
        console.error('[tripCrudService] Error fetching trip items:', itemsError);
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
      console.error('[tripCrudService] Error fetching trip crews:', crewsError);
      // Don't throw, just continue without crews
    }

    // Fetch staff details for crews
    let crewsWithDetails: DeliveryTripCrewWithDetails[] = [];
    if (tripCrews && tripCrews.length > 0) {
      const staffIds = tripCrews.map(c => c.staff_id);
      const { data: staffList } = await supabase
        .from('service_staff')
        .select('id, name, employee_code, phone, user_id')
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

    let resolvedDriverId = data.driver_id || user.id;
    if (data.driver_staff_id) {
      const { data: driverStaffRow } = await supabase
        .from('service_staff')
        .select('user_id')
        .eq('id', data.driver_staff_id)
        .maybeSingle();
      if (driverStaffRow?.user_id) {
        resolvedDriverId = driverStaffRow.user_id;
      }
    }

    // Start transaction-like operation
    // 1. Create delivery trip
    const tripData: DeliveryTripInsert = {
      vehicle_id: data.vehicle_id,
      driver_id: resolvedDriverId,
      planned_date: data.planned_date,
      odometer_start: data.odometer_start,
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
      console.error('[tripCrudService] Error creating trip:', tripError);
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
            console.error('[tripCrudService] Error creating driver crew from driver_staff_id:', insertDriverCrewError);
          } else {
            console.log('[tripCrudService] Created driver crew from explicit driver_staff_id:', {
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
              console.error('[tripCrudService] Error matching driver to service_staff:', staffError);
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
                  console.error('[tripCrudService] Error creating driver crew from name match:', insertDriverCrewError);
                }
              }
            }
          }
        }
      }
    } catch (driverCrewError) {
      console.error('[tripCrudService] Failed to sync driver to delivery_trip_crews:', driverCrewError);
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
        console.error('[tripCrudService] Error creating trip crew:', crewError);
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
        console.warn('[tripCrudService] Store already exists in trip, skipping:', {
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
            console.error('[tripCrudService] Error creating trip items:', itemsError);
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
        console.error('[tripCrudService] Error creating trip store:', storeError);
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
          console.error('[tripCrudService] Error creating trip items:', itemsError);
          throw itemsError;
        }
      }
    }

    // Return full trip with relations
    const fullTrip = await tripCrudService.getById(trip.id);
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
    const isDataEdit = data.vehicle_id || data.driver_id || data.driver_staff_id || data.planned_date ||
      data.trip_revenue !== undefined || data.trip_start_date !== undefined || data.trip_end_date !== undefined ||
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
      console.error('[tripCrudService] Error fetching current trip:', fetchError);
      throw fetchError;
    }

    // Extract relation data & reason from input (not direct columns)
    const stores = data.stores;
    const changeReason = data.change_reason;
    const editReason = data.edit_reason;
    let itemChangesOccurred = false;
    let crewChangesOccurred = false;
    const effectiveTripStatus = data.status ?? currentTrip.status;

    // Update trip basic info (exclude stores/change_reason/edit_reason - they are not columns)
    // Create updateData without relation fields to avoid PGRST204 error
    const updateData: DeliveryTripUpdate = {
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      planned_date: data.planned_date,
      trip_revenue: data.trip_revenue,
      trip_start_date: data.trip_start_date,
      trip_end_date: data.trip_end_date,
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

    // คนขับจากฟอร์มผูกกับพนักงาน (driver_staff_id) — ต้องซิงก์ delivery_trips.driver_id กับ profiles
    // มิฉะนั้นหน้าใช้งานรถจะยังเทียบ user.id กับ driver_id คนเดิม แม้ crew เปลี่ยนแล้ว
    if (data.driver_staff_id) {
      const { data: driverStaffRow } = await supabase
        .from('service_staff')
        .select('user_id')
        .eq('id', data.driver_staff_id)
        .maybeSingle();
      if (driverStaffRow?.user_id) {
        updateData.driver_id = driverStaffRow.user_id;
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
    const fieldsToTrack = ['vehicle_id', 'driver_id', 'planned_date', 'trip_revenue', 'trip_start_date', 'trip_end_date', 'odometer_start', 'odometer_end', 'status', 'notes', 'sequence_order'];
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
      console.error('[tripCrudService] Error updating trip:', updateError);
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
          console.error('[tripCrudService] Error saving audit log:', auditError);
          // Don't throw - audit log failure shouldn't block the update
        }
      } catch (auditError) {
        console.error('[tripCrudService] Error saving audit log:', auditError);
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
        console.error('[tripCrudService] Error loading existing crews:', existingCrewsError);
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
        const helperAssignmentStartAt = await resolveCrewAssignmentStartAt(id, effectiveTripStatus);
        const crewData = helpersToAdd.map(staffId => ({
          delivery_trip_id: id,
          staff_id: staffId,
          role: 'helper' as const,
          status: 'active' as const,
          start_at: helperAssignmentStartAt,
          created_by: user.id,
          updated_by: user.id,
        }));

        const { error: crewError } = await supabase
          .from('delivery_trip_crews')
          .insert(crewData);

        if (crewError) {
          console.error('[tripCrudService] Error adding helpers:', crewError);
          // Don't throw - allow trip update to continue
          // But log the error for debugging
        } else {
          console.log('[tripCrudService] Successfully added helpers:', helpersToAdd);
          crewChangesOccurred = true;
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
          console.error('[tripCrudService] Error removing helpers:', removeError);
          // Don't throw - allow trip update to continue
        } else {
          console.log('[tripCrudService] Successfully removed helpers:', helpersToRemove);
          crewChangesOccurred = true;
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
          const nextDriverStartAt = effectiveTripStatus === 'completed'
            ? await resolveCrewAssignmentStartAt(id, effectiveTripStatus)
            : now;
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
              start_at: nextDriverStartAt,
              created_by: user.id,
              updated_by: user.id,
            });
          crewChangesOccurred = true;
        } else if (!currentDriverCrew) {
          // No driver crew yet, add new one
          const driverAssignmentStartAt = await resolveCrewAssignmentStartAt(id, effectiveTripStatus);
          await supabase
            .from('delivery_trip_crews')
            .insert({
              delivery_trip_id: id,
              staff_id: data.driver_staff_id,
              role: 'driver',
              status: 'active',
              start_at: driverAssignmentStartAt,
              created_by: user.id,
              updated_by: user.id,
            });
          crewChangesOccurred = true;
        }
        // If same driver, do nothing
      } catch (driverCrewError) {
        console.error('[tripCrudService] Error updating driver crew:', driverCrewError);
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
        console.error('[tripCrudService] Error loading existing trip stores:', existingStoresError);
        throw existingStoresError;
      }

      const existingStoreIds = (existingStores || []).map(s => s.id);

      const { data: existingItems, error: existingItemsError } = existingStoreIds.length > 0 ? await supabase
        .from('delivery_trip_items')
        .select('id, delivery_trip_store_id, product_id, quantity, notes, is_bonus, selected_pallet_config_id')
        .in('delivery_trip_store_id', existingStoreIds) : { data: [] as any[], error: null };

      if (existingItemsError) {
        console.error('[tripCrudService] Error loading existing trip items:', existingItemsError);
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
        store_id: string | null;  // เพิ่ม store_id โดยตรง เพื่อให้ดึงชื่อร้านค้าได้แม้หลัง delivery_trip_stores ถูกลบ
        delivery_trip_item_id: string | null;
        product_id: string | null;
        old_quantity: number | null;
        new_quantity: number | null;
      }) => {
        const { action, delivery_trip_store_id, store_id, delivery_trip_item_id, product_id, old_quantity, new_quantity } = params;
        itemChangesOccurred = true;
        const { error: logError } = await supabase
          .from('delivery_trip_item_changes')
          .insert({
            delivery_trip_id: id,
            delivery_trip_store_id,
            store_id,  // เพิ่ม store_id โดยตรง เพื่อให้ history lookup ทำงานได้แม้หลัง store ถูกลบ
            delivery_trip_item_id,
            product_id,
            action: action,
            old_quantity,
            new_quantity,
            reason: changeReason || null,
            created_by: user.id,
          } as any);

        if (logError) {
          console.error('[tripCrudService] Error logging item change:', logError);
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
              console.error('[tripCrudService] Error resetting orders for removed stores:', resetOrdersError);
              throw resetOrdersError;
            }
          }
        }

        // Build map: delivery_trip_store.id -> store_id (for logging before delete)
        const removedStoreIdMap = new Map<string, string>(storesToRemove.map((s: any) => [s.id as string, s.store_id as string]));

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
              store_id: removedStoreIdMap.get(item.delivery_trip_store_id) || null,  // เพิ่ม store_id โดยตรง
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
          console.error('[tripCrudService] Error deleting removed trip stores:', deleteRemovedStoresError);
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
            console.error('[tripCrudService] Error creating trip store:', storeError);
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
              console.error('[tripCrudService] Error updating trip store sequence:', updateStoreError);
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
              store_id: storeData.store_id,
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
            console.error('[tripCrudService] Error deleting removed trip items:', deleteItemsError);
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
              console.error('[tripCrudService] Error creating trip item:', insertItemError);
              throw insertItemError;
            }

            const insertedItem = insertedItems[0];

            await insertChangeLog({
              action: 'add',
              delivery_trip_store_id: tripStoreId,
              store_id: storeData.store_id,
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
                console.error('[tripCrudService] Error updating trip item:', updateItemError);
                throw updateItemError;
              }

              await insertChangeLog({
                action: 'update',
                delivery_trip_store_id: existingItem.delivery_trip_store_id,
                store_id: storeData.store_id,
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
        console.error('[tripCrudService] Error updating item change flags on trip:', flagError);
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
              '[tripCrudService] Trip items changed for completed trip. Invoking auto-commission-worker:',
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
            '[tripCrudService] Failed to invoke auto-commission-worker after item changes:',
            commissionRecalcError
          );
          // ไม่ throw ต่อ เพื่อไม่ให้กระทบ UX การแก้ไขทริป
        }
      }
    }

    if (crewChangesOccurred) {
      await recalculateCompletedTripCommission(id, 'trip_crew_update', effectiveTripStatus);
    }

    // Return updated trip
    const updatedTrip = await tripCrudService.getById(id);
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

    // เช็คสถานะทริปก่อนว่าเป็น completed หรือไม่
    // - ถ้าไม่ completed: ไม่ควรรีเซ็ต/รีคำนวณ quantity_delivered จาก completed trips อื่น
    // - ถ้าเป็น completed: ค่อยรีคำนวณ quantity_delivered เพื่อ rollback ตาม FIFO
    const { data: trip, error: tripError } = await supabase
      .from('delivery_trips')
      .select('id, status')
      .eq('id', id)
      .single();

    if (tripError || !trip) {
      throw tripError || new Error('ไม่พบ delivery_trip');
    }

    // 1. หาออเดอร์ทั้งหมดที่เชื่อมกับทริปนี้
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('delivery_trip_id', id);

    if (ordersError) {
      console.error('[tripCrudService] Error fetching orders:', ordersError);
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
        console.error('[tripCrudService] Error updating orders:', updateOrdersError);
        throw updateOrdersError;
      }

      if (trip.status === 'completed') {
        // rollback เฉพาะเมื่อทริปนั้น completed
        const { error: rpcError } = await supabase.rpc('recalculate_quantity_delivered_after_order_unassign', {
          p_order_ids: orderIds,
          p_excluded_trip_id: id,
        });

        if (rpcError) {
          console.error('[tripCrudService] recalculate_quantity_delivered_after_order_unassign:', rpcError);
          throw new Error(
            rpcError.message || 'ไม่สามารถรีแคล์ยอดจัดส่งหลังถอดออเดอร์จากทริปได้ (ตรวจสอบว่า migration RPC ถูก apply แล้ว)'
          );
        }

        console.log(`[tripCrudService] Reset ${orderIds.length} orders (FIFO rollback quantity_delivered)`);
      } else {
        // ทริปยังไม่ completed: ล้าง quantity_delivered ก่อน แล้วค่อยรีคำนวณ orders.status
        // เหตุผล: ค่า quantity_delivered ใน order_items อาจค้างมาจากทริป completed อื่น
        //         ที่ระบบเคยเขียนไว้ (trigger/backfill) ต้องล้างก่อนเสมอเมื่อถอดออเดอร์จากทริปที่ไม่ completed
        const { error: resetQtyError } = await supabase
          .from('order_items')
          .update({ quantity_delivered: 0, updated_at: new Date().toISOString() })
          .in('order_id', orderIds)
          .neq('fulfillment_method', 'pickup');

        if (resetQtyError) {
          console.error('[tripCrudService] Error resetting quantity_delivered before recalc:', resetQtyError);
          // ไม่ throw — ให้ RPC ทำการ reset อีกรอบ (RPC มี logic reset ของตัวเองแล้ว)
        }

        const { error: rpcError } = await supabase.rpc('recalculate_orders_status_from_fulfillment_quantities', {
          p_order_ids: orderIds,
        });

        if (rpcError) {
          console.error('[tripCrudService] recalculate_orders_status_from_fulfillment_quantities:', rpcError);
          throw new Error(
            rpcError.message || 'ไม่สามารถรีคำนวณ orders.status หลังลบทริปได้ (ตรวจสอบว่า migration RPC ถูก apply แล้ว)'
          );
        }

        console.log(`[tripCrudService] Reset quantity_delivered + recalc ${orderIds.length} orders.status (trip not completed)`);
      }
    }

    // 5. ลบทริป (CASCADE จะลบข้อมูลที่เกี่ยวข้องอัตโนมัติ)
    const { error } = await supabase
      .from('delivery_trips')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[tripCrudService] Error deleting trip:', error);
      throw error;
    }
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
      console.error('[tripCrudService] Error updating quantity_picked_up_at_store:', error);
      throw error;
    }
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
    const trip = await tripCrudService.getById(tripId);
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
      console.error('[tripCrudService] Error updating vehicle:', updateError);
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
      console.error('[tripCrudService] Error logging vehicle change:', logError);
      // Don't throw - continue even if logging fails
    }

    // ยกเลิกการผูก trip logs ที่มีอยู่
    // เพราะรถเปลี่ยนแล้ว trip log เก่าไม่ควรผูกกับทริปนี้
    const { error: unlinkError } = await supabase
      .from('trip_logs')
      .update({ delivery_trip_id: null })
      .eq('delivery_trip_id', tripId);

    if (unlinkError) {
      console.error('[tripCrudService] Error unlinking trip logs:', unlinkError);
      // Don't throw - this is not critical
    }

    console.log('[tripCrudService] Vehicle changed successfully:', {
      trip_id: tripId,
      old_vehicle_id: oldVehicleId,
      new_vehicle_id: newVehicleId,
      reason,
    });

    return tripCrudService.getById(tripId) as Promise<DeliveryTripWithRelations>;
  },

};

