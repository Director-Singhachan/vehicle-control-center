// Fuel Service - CRUD operations for fuel_records
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type FuelRecord = Database['public']['Tables']['fuel_records']['Row'];
type FuelRecordInsert = Database['public']['Tables']['fuel_records']['Insert'];
type FuelRecordUpdate = Database['public']['Tables']['fuel_records']['Update'];
type FuelEfficiencySummary = Database['public']['Views']['fuel_efficiency_summary']['Row'];

export const fuelService = {
  // Get all fuel records
  getAll: async (filters?: {
    vehicle_id?: string;
    user_id?: string;
  }): Promise<FuelRecord[]> => {
    let query = supabase
      .from('fuel_records')
      .select('*')
      .order('filled_at', { ascending: false });
    
    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // Get fuel record by ID
  getById: async (id: string): Promise<FuelRecord | null> => {
    const { data, error } = await supabase
      .from('fuel_records')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get fuel efficiency summary (using view)
  getEfficiencySummary: async (vehicleId?: string): Promise<FuelEfficiencySummary[]> => {
    let query = supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .order('month', { ascending: false });
    
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // Get latest fuel record for a vehicle
  getLatest: async (vehicleId: string): Promise<FuelRecord | null> => {
    const { data, error } = await supabase
      .from('fuel_records')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('filled_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data || null;
  },

  // Create fuel record
  create: async (record: FuelRecordInsert): Promise<FuelRecord> => {
    const { data, error } = await supabase
      .from('fuel_records')
      .insert(record)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update fuel record
  update: async (id: string, updates: FuelRecordUpdate): Promise<FuelRecord> => {
    const { data, error } = await supabase
      .from('fuel_records')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete fuel record
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('fuel_records')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

