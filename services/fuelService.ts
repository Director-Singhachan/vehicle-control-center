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

  // Get fuel history with pagination and filters
  getFuelHistory: async (filters?: {
    vehicle_id?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    fuel_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: (FuelRecord & { user?: { full_name: string; email?: string } })[]; count: number }> => {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    let query = supabase
      .from('fuel_records')
      .select(`
        *,
        user:profiles!user_id(full_name, email)
      `, { count: 'exact' })
      .order('filled_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.start_date) {
      query = query.gte('filled_at', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('filled_at', filters.end_date);
    }
    if (filters?.fuel_type) {
      query = query.eq('fuel_type', filters.fuel_type);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return {
      data: data || [],
      count: count || 0,
    };
  },

  // Get fuel statistics
  getFuelStats: async (filters?: {
    vehicle_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    totalCost: number;
    totalLiters: number;
    averagePricePerLiter: number;
    averageEfficiency: number | null;
    totalRecords: number;
  }> => {
    let query = supabase
      .from('fuel_records')
      .select('total_cost, liters, price_per_liter, fuel_efficiency');

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.start_date) {
      query = query.gte('filled_at', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('filled_at', filters.end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    const records = data || [];
    const totalCost = records.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
    const totalLiters = records.reduce((sum, r) => sum + (Number(r.liters) || 0), 0);
    const totalPrice = records.reduce((sum, r) => sum + (Number(r.price_per_liter) || 0), 0);
    const efficiencyRecords = records.filter(r => r.fuel_efficiency !== null);
    const totalEfficiency = efficiencyRecords.reduce((sum, r) => sum + (Number(r.fuel_efficiency) || 0), 0);

    return {
      totalCost,
      totalLiters,
      averagePricePerLiter: records.length > 0 ? totalPrice / records.length : 0,
      averageEfficiency: efficiencyRecords.length > 0 ? totalEfficiency / efficiencyRecords.length : null,
      totalRecords: records.length,
    };
  },

  // Upload receipt image
  uploadReceipt: async (file: File, vehicleId: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${vehicleId}/${user.id}/${Date.now()}.${fileExt}`;
    const filePath = `fuel-receipts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments') // Using existing bucket, or create new one
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  },
};

