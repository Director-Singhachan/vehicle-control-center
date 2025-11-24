// Vehicle Service - CRUD operations for vehicles
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import { useAuthStore } from '../stores/authStore';

// Debug: Check if supabase client is initialized
if (typeof window !== 'undefined') {
  console.log('[vehicleService] Supabase client initialized:', !!supabase);
  console.log('[vehicleService] Supabase auth available:', !!supabase?.auth);
}

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert'];
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update'];
type VehicleWithStatus = Database['public']['Views']['vehicles_with_status']['Row'];

export interface VehicleSummary {
  total: number;
  active: number;
  maintenance: number;
  idle: number;
}

export interface VehicleForMap {
  id: string;
  plate: string;
  make?: string;
  model?: string;
  status: 'active' | 'maintenance' | 'idle';
  lat?: number;
  lng?: number;
  fuelLevel?: number;
}

export const vehicleService = {
  // Get all vehicles
  getAll: async (): Promise<Vehicle[]> => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get vehicle by ID
  getById: async (id: string): Promise<Vehicle | null> => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Get vehicles with status (using view)
  getWithStatus: async (): Promise<VehicleWithStatus[]> => {
    const { data, error } = await supabase
      .from('vehicles_with_status')
      .select('*');

    if (error) throw error;
    return data || [];
  },

  // Get vehicle dashboard data (using view)
  getDashboardData: async (vehicleId?: string) => {
    try {
      console.log('[vehicleService] Fetching dashboard data...', vehicleId ? `for vehicle: ${vehicleId}` : 'all vehicles');
      let query = supabase
        .from('vehicle_dashboard')
        .select('*');

      if (vehicleId) {
        query = query.eq('id', vehicleId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[vehicleService] Error fetching dashboard data:', error);
        throw error;
      }

      console.log('[vehicleService] Dashboard data count:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('[vehicleService] getDashboardData error:', error);
      throw error;
    }
  },

  // Get vehicle summary (counts by status)
  getSummary: async (): Promise<VehicleSummary> => {
    try {
      console.log('[vehicleService] Fetching summary...');

      // Check if user is authenticated
      console.log('[vehicleService] Checking authentication...');
      const sessionStartTime = Date.now();

      // Add timeout to getSession to prevent hanging
      const getSessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<{ data: { session: any }, error: any }>((resolve) => {
        setTimeout(() => {
          console.warn('[vehicleService] getSession timeout after 5s');
          resolve({ data: { session: null }, error: null }); // Resolve with null session on timeout
        }, 5000);
      });

      let { data: { session }, error: sessionError } = await Promise.race([getSessionPromise, timeoutPromise]);

      const sessionElapsed = Date.now() - sessionStartTime;
      console.log(`[vehicleService] getSession() took ${sessionElapsed}ms`);

      if (sessionError) {
        console.error('[vehicleService] Session error:', sessionError);
        // Don't throw yet, try fallback
      }

      // Fallback: Check authStore if session is missing (e.g. timeout or error)
      if (!session) {
        const storeUser = useAuthStore.getState().user;
        if (storeUser) {
          console.log('[vehicleService] Using user from store as fallback');
          // Create a minimal session object with just the user
          session = { user: storeUser } as any;
        } else {
          console.error('[vehicleService] No session and no store user - user not authenticated');
          throw new Error('User not authenticated');
        }
      }

      console.log('[vehicleService] User authenticated:', session.user.id);

      // Use Promise.all for parallel execution
      const [totalResult, activeResult, maintenanceResult] = await Promise.all([
        // Total vehicles
        supabase
          .from('vehicles')
          .select('id', { count: 'exact', head: true }),

        // Active vehicles (in use)
        supabase
          .from('vehicle_usage')
          .select('vehicle_id', { count: 'exact', head: true })
          .eq('status', 'in_progress'),

        // Maintenance vehicles
        supabase
          .from('tickets')
          .select('vehicle_id', { count: 'exact', head: true })
          .in('status', ['pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress'])
      ]);

      if (totalResult.error) throw totalResult.error;
      if (activeResult.error) throw activeResult.error;
      if (maintenanceResult.error) throw maintenanceResult.error;

      const total = totalResult.count || 0;
      const active = activeResult.count || 0;
      const maintenance = maintenanceResult.count || 0;

      console.log('[vehicleService] Summary counts:', { total, active, maintenance });

      return {
        total,
        active,
        maintenance,
        idle: total - active - maintenance,
      };
    } catch (error) {
      console.error('[vehicleService] getSummary error:', error);
      throw error;
    }
  },

  // Get vehicles with locations (for map)
  getLocations: async (): Promise<VehicleForMap[]> => {
    try {
      console.log('[vehicleService] Fetching locations...');
      // Select only necessary columns for map
      const { data, error } = await supabase
        .from('vehicles_with_status')
        .select('id, plate, make, model, status, lat, lng, last_fuel_efficiency')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error) {
        console.error('[vehicleService] Error fetching locations:', error);
        throw error;
      }

      console.log('[vehicleService] Locations count:', data?.length || 0);

      return (data || []).map(v => ({
        id: v.id,
        plate: v.plate,
        make: v.make || undefined,
        model: v.model || undefined,
        status: (v.status as 'active' | 'maintenance' | 'idle') || 'idle',
        lat: v.lat || undefined,
        lng: v.lng || undefined,
        fuelLevel: v.last_fuel_efficiency || undefined,
      }));
    } catch (error) {
      console.error('[vehicleService] getLocations error:', error);
      throw error;
    }
  },

  // Create new vehicle
  create: async (vehicle: VehicleInsert): Promise<Vehicle> => {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(vehicle)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update vehicle
  update: async (id: string, updates: VehicleUpdate): Promise<Vehicle> => {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete vehicle
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
