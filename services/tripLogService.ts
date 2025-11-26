// Trip Log Service - CRUD operations for trip logs (check-out/check-in)
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type TripLog = Database['public']['Tables']['trip_logs']['Row'];
type TripLogInsert = Database['public']['Tables']['trip_logs']['Insert'];
type TripLogUpdate = Database['public']['Tables']['trip_logs']['Update'];

export interface TripLogWithRelations extends TripLog {
  vehicle?: {
    plate: string;
    make?: string;
    model?: string;
    image_url?: string;
  };
  driver?: {
    full_name: string;
    email?: string;
    avatar_url?: string | null;
  };
}

export interface CheckoutData {
  vehicle_id: string;
  odometer_start: number;
  checkout_time?: string; // ISO string - optional, defaults to now()
  destination?: string;
  route?: string;
  notes?: string;
}

export interface CheckinData {
  odometer_end: number;
  destination?: string;
  route?: string;
  notes?: string;
}

export const tripLogService = {
  // Create check-out (start trip)
  createCheckout: async (data: CheckoutData): Promise<TripLog> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Use provided checkout_time or default to now()
    const checkoutTime = data.checkout_time || new Date().toISOString();

    const tripLog: TripLogInsert = {
      vehicle_id: data.vehicle_id,
      driver_id: user.id,
      odometer_start: data.odometer_start,
      checkout_time: checkoutTime,
      destination: data.destination,
      route: data.route,
      notes: data.notes,
      status: 'checked_out',
    };

    const { data: result, error } = await supabase
      .from('trip_logs')
      .insert(tripLog)
      .select()
      .single();

    if (error) {
      console.error('[tripLogService] Error creating checkout:', error);
      throw error;
    }

    return result;
  },

  // Update check-in (end trip)
  updateCheckin: async (tripId: string, data: CheckinData): Promise<TripLog> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get the trip to validate
    const { data: trip, error: fetchError } = await supabase
      .from('trip_logs')
      .select('*')
      .eq('id', tripId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status === 'checked_in') {
      throw new Error('Trip already checked in');
    }

    // Validate odometer
    if (data.odometer_end <= trip.odometer_start) {
      throw new Error('Odometer end must be greater than odometer start');
    }

    const distance = data.odometer_end - trip.odometer_start;
    if (distance > 500) {
      throw new Error('Distance exceeds maximum allowed (500 km). Please verify.');
    }

    const updateData: TripLogUpdate = {
      odometer_end: data.odometer_end,
      checkin_time: new Date().toISOString(),
      status: 'checked_in',
      destination: data.destination ?? trip.destination,
      route: data.route ?? trip.route,
      notes: data.notes ?? trip.notes,
    };

    const { data: result, error } = await supabase
      .from('trip_logs')
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single();

    if (error) {
      console.error('[tripLogService] Error updating checkin:', error);
      throw error;
    }

    return result;
  },

  // Get active trips by vehicle (trips that are checked out but not checked in)
  getActiveTripsByVehicle: async (vehicleId?: string): Promise<TripLogWithRelations[]> => {
    let query = supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url)
      `)
      .eq('status', 'checked_out')
      .order('checkout_time', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[tripLogService] Error fetching active trips:', error);
      throw error;
    }

    // Log for debugging - remove in production
    console.log('[tripLogService] Active trips fetched:', {
      vehicleId: vehicleId || 'all',
      count: data?.length || 0,
      trips: data?.map(t => ({ id: t.id, vehicle_id: t.vehicle_id, driver_id: t.driver_id })) || [],
    });

    return (data || []) as TripLogWithRelations[];
  },

  // Get trip history with pagination
  getTripHistory: async (filters?: {
    vehicle_id?: string;
    driver_id?: string;
    start_date?: string;
    end_date?: string;
    status?: 'checked_out' | 'checked_in';
    limit?: number;
    offset?: number;
    search?: string; // For text search
  }): Promise<{ data: TripLogWithRelations[]; count: number }> => {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    let query = supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url)
      `, { count: 'exact' })
      .order('checkout_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }

    if (filters?.driver_id) {
      query = query.eq('driver_id', filters.driver_id);
    }

    if (filters?.start_date) {
      query = query.gte('checkout_time', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('checkout_time', filters.end_date);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // Database-level text search using ILIKE
    // Search in fields that are directly in trip_logs table (destination, route, notes)
    // Note: For searching across relations (vehicle.plate, driver.full_name), 
    // Supabase doesn't easily support ILIKE on joined relations in a single query.
    // We'll search trip_logs fields at DB level, then filter relations client-side on the limited results
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      // Search in trip_logs table fields using OR operator
      query = query.or(
        `destination.ilike.${searchPattern},route.ilike.${searchPattern},notes.ilike.${searchPattern}`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[tripLogService] Error fetching trip history:', error);
      throw error;
    }

    let results = (data || []) as TripLogWithRelations[];

    // Apply additional text search filter for related fields (vehicle plate, driver name)
    // This filters the already-limited results from database (much faster than filtering all records)
    // Note: This is a hybrid approach - DB filters trip_logs fields, client filters relations
    // For better performance with relations, consider using a database function or view
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(trip =>
        trip.vehicle?.plate?.toLowerCase().includes(searchLower) ||
        trip.driver?.full_name?.toLowerCase().includes(searchLower) ||
        // Note: destination, route, notes are already filtered at DB level,
        // but we keep them here for consistency in case the DB filter didn't catch everything
        trip.destination?.toLowerCase().includes(searchLower) ||
        trip.route?.toLowerCase().includes(searchLower)
      );
      // Adjust count for client-side filtering (approximate)
      // In a production system, you'd want to get accurate count from DB with all filters
    }

    return {
      data: results,
      count: count || 0, // Note: count may not be accurate if client-side filtering is applied
    };
  },

  // Get trip by ID
  getById: async (tripId: string): Promise<TripLogWithRelations | null> => {
    const { data, error } = await supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url)
      `)
      .eq('id', tripId)
      .single();

    if (error) {
      console.error('[tripLogService] Error fetching trip:', error);
      throw error;
    }

    return data as TripLogWithRelations | null;
  },

  // Get last odometer reading for a vehicle
  getLastOdometer: async (vehicleId: string): Promise<number | null> => {
    // Get last known odometer reading
    const [fuelResult, tripResult] = await Promise.all([
      // From fuel records
      supabase
        .from('fuel_records')
        .select('odometer')
        .eq('vehicle_id', vehicleId)
        .order('filled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // From trip logs - only get checked-in trips (where odometer_end is not null)
      supabase
        .from('trip_logs')
        .select('odometer_end')
        .eq('vehicle_id', vehicleId)
        .not('odometer_end', 'is', null)
        .order('checkin_time', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Handle errors gracefully - if query fails, just ignore that source
    const lastFuelOdometer = fuelResult.error ? null : fuelResult.data?.odometer;
    const lastTripOdometer = tripResult.error ? null : tripResult.data?.odometer_end;

    const lastOdometer = Math.max(
      lastFuelOdometer || 0,
      lastTripOdometer || 0
    );

    return lastOdometer > 0 ? lastOdometer : null;
  },

  // Validate odometer reading
  validateOdometer: async (vehicleId: string, odometer: number): Promise<{
    valid: boolean;
    lastOdometer?: number;
    warning?: string;
  }> => {
    // Get last known odometer reading
    const [fuelResult, tripResult] = await Promise.all([
      // From fuel records
      supabase
        .from('fuel_records')
        .select('odometer')
        .eq('vehicle_id', vehicleId)
        .order('filled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // From trip logs - only get checked-in trips (where odometer_end is not null)
      supabase
        .from('trip_logs')
        .select('odometer_end')
        .eq('vehicle_id', vehicleId)
        .not('odometer_end', 'is', null)
        .order('checkin_time', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Handle errors gracefully - if query fails, just ignore that source
    const lastFuelOdometer = fuelResult.error ? null : fuelResult.data?.odometer;
    const lastTripOdometer = tripResult.error ? null : tripResult.data?.odometer_end;

    const lastOdometer = Math.max(
      lastFuelOdometer || 0,
      lastTripOdometer || 0
    );

    if (odometer < lastOdometer) {
      return {
        valid: false,
        lastOdometer,
        warning: `เลขไมล์ (${odometer.toLocaleString()}) น้อยกว่าเลขไมล์ล่าสุด (${lastOdometer.toLocaleString()}) กรุณาตรวจสอบ`,
      };
    }

    if (odometer > lastOdometer + 10000) {
      return {
        valid: true,
        lastOdometer,
        warning: `เลขไมล์ (${odometer.toLocaleString()}) สูงกว่าเลขไมล์ล่าสุดมาก (${lastOdometer.toLocaleString()}) กรุณาตรวจสอบ`,
      };
    }

    return {
      valid: true,
      lastOdometer: lastOdometer || undefined,
    };
  },

  // Get trips that have been checked out for more than 12 hours
  getOverdueTrips: async (): Promise<TripLogWithRelations[]> => {
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    const { data, error } = await supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url)
      `)
      .eq('status', 'checked_out')
      .lt('checkout_time', twelveHoursAgo.toISOString())
      .order('checkout_time', { ascending: true });

    if (error) {
      console.error('[tripLogService] Error fetching overdue trips:', error);
      throw error;
    }

    return (data || []) as TripLogWithRelations[];
  },
};

