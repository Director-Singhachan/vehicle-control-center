// Vehicle Service - CRUD operations for vehicles
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

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
    let query = supabase
      .from('vehicle_dashboard')
      .select('*');
    
    if (vehicleId) {
      query = query.eq('id', vehicleId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // Get vehicle summary (counts by status)
  getSummary: async (): Promise<VehicleSummary> => {
    // Total vehicles
    const { count: total } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    // Active vehicles (in use)
    const { count: active } = await supabase
      .from('vehicle_usage')
      .select('vehicle_id', { count: 'exact', head: true })
      .eq('status', 'in_progress');
    
    // Maintenance vehicles
    const { count: maintenance } = await supabase
      .from('tickets')
      .select('vehicle_id', { count: 'exact', head: true })
      .in('status', ['pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress']);
    
    return {
      total: total || 0,
      active: active || 0,
      maintenance: maintenance || 0,
      idle: (total || 0) - (active || 0) - (maintenance || 0),
    };
  },

  // Get vehicles with locations (for map)
  getLocations: async (): Promise<VehicleForMap[]> => {
    const { data, error } = await supabase
      .from('vehicles_with_status')
      .select('*')
      .not('lat', 'is', null)
      .not('lng', 'is', null);
    
    if (error) throw error;
    
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

