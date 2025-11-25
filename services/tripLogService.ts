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
  };
  driver?: {
    full_name: string;
    email?: string;
  };
}

export interface CheckoutData {
  vehicle_id: string;
  odometer_start: number;
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

    const tripLog: TripLogInsert = {
      vehicle_id: data.vehicle_id,
      driver_id: user.id,
      odometer_start: data.odometer_start,
      checkout_time: new Date().toISOString(),
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
        vehicle:vehicles!trip_logs_vehicle_id_fkey(plate, make, model),
        driver:profiles!trip_logs_driver_id_fkey(full_name, email)
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

    return (data || []) as TripLogWithRelations[];
  },

  // Get trip history
  getTripHistory: async (filters?: {
    vehicle_id?: string;
    driver_id?: string;
    start_date?: string;
    end_date?: string;
    status?: 'checked_out' | 'checked_in';
  }): Promise<TripLogWithRelations[]> => {
    let query = supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles!trip_logs_vehicle_id_fkey(plate, make, model),
        driver:profiles!trip_logs_driver_id_fkey(full_name, email)
      `)
      .order('checkout_time', { ascending: false })
      .limit(100);

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

    const { data, error } = await query;

    if (error) {
      console.error('[tripLogService] Error fetching trip history:', error);
      throw error;
    }

    return (data || []) as TripLogWithRelations[];
  },

  // Get trip by ID
  getById: async (tripId: string): Promise<TripLogWithRelations | null> => {
    const { data, error } = await supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles!trip_logs_vehicle_id_fkey(plate, make, model),
        driver:profiles!trip_logs_driver_id_fkey(full_name, email)
      `)
      .eq('id', tripId)
      .single();

    if (error) {
      console.error('[tripLogService] Error fetching trip:', error);
      throw error;
    }

    return data as TripLogWithRelations | null;
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
        .single(),
      
      // From trip logs
      supabase
        .from('trip_logs')
        .select('odometer_end')
        .eq('vehicle_id', vehicleId)
        .not('odometer_end', 'is', null)
        .order('checkin_time', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const lastFuelOdometer = fuelResult.data?.odometer;
    const lastTripOdometer = tripResult.data?.odometer_end;
    
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
        vehicle:vehicles!trip_logs_vehicle_id_fkey(plate, make, model),
        driver:profiles!trip_logs_driver_id_fkey(full_name, email)
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

