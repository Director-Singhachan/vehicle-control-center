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
    try {
      console.log('[vehicleService] getAll: Starting...');
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[vehicleService] getAll: Error:', error);
        // Check for common deployment issues
        if (error.message.includes('JWT') || error.message.includes('permission') || error.message.includes('policy')) {
          throw new Error('ไม่มีสิทธิ์เข้าถึงข้อมูล กรุณาตรวจสอบการ login และสิทธิ์การเข้าถึง');
        }
        if (error.message.includes('fetch') || error.message.includes('network')) {
          throw new Error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        }
        throw error;
      }

      console.log('[vehicleService] getAll: Success, count:', data?.length || 0);
      return data || [];
    } catch (err) {
      console.error('[vehicleService] getAll: Exception:', err);
      throw err;
    }
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
    try {
      console.log('[vehicleService] getWithStatus: Starting...');
      const { data, error } = await supabase
        .from('vehicles_with_status')
        .select('*');

      if (error) {
        console.error('[vehicleService] getWithStatus: Error:', error);
        // Don't throw - return empty array so vehicles list can still show
        // This view might not exist or have permission issues
        console.warn('[vehicleService] getWithStatus: Returning empty array due to error');
        return [];
      }

      console.log('[vehicleService] getWithStatus: Success, count:', data?.length || 0);
      return data || [];
    } catch (err) {
      console.error('[vehicleService] getWithStatus: Exception:', err);
      // Don't throw - return empty array so vehicles list can still show
      return [];
    }
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

      // Use getCurrentUser helper which has localStorage fallback and shorter timeout
      const { getCurrentUser } = await import('../lib/supabase');
      const user = await getCurrentUser();

      const sessionElapsed = Date.now() - sessionStartTime;
      console.log(`[vehicleService] getCurrentUser() took ${sessionElapsed}ms`);

      if (!user) {
        // Fallback: Check authStore if user is missing
        const storeUser = useAuthStore.getState().user;
        if (storeUser) {
          console.log('[vehicleService] Using user from store as fallback');
          // Continue with storeUser - queries will use RLS which checks auth.uid()
        } else {
          console.error('[vehicleService] No user and no store user - user not authenticated');
          throw new Error('User not authenticated');
        }
      } else {
        console.log('[vehicleService] User authenticated:', user.id);
      }

      // Use Promise.all for parallel execution
      const [totalResult, activeResult, maintenanceResult] = await Promise.all([
        // Total vehicles
        supabase
          .from('vehicles')
          .select('id', { count: 'exact', head: true }),

        // Active vehicles (in use) - Count from trip_logs where status = 'checked_out'
        // This represents vehicles that are currently checked out but not yet checked in
        supabase
          .from('trip_logs')
          .select('vehicle_id', { count: 'exact', head: true })
          .eq('status', 'checked_out'),

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
