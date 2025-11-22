// Vehicle Usage Service - CRUD operations for vehicle_usage
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type VehicleUsage = Database['public']['Tables']['vehicle_usage']['Row'];
type VehicleUsageInsert = Database['public']['Tables']['vehicle_usage']['Insert'];
type VehicleUsageUpdate = Database['public']['Tables']['vehicle_usage']['Update'];
type DailyUsage = Database['public']['Views']['vehicle_usage_daily']['Row'];

export interface DailyUsageData {
  labels: string[];
  data: number[];
}

export const usageService = {
  // Get all vehicle usage records
  getAll: async (filters?: {
    vehicle_id?: string;
    user_id?: string;
    status?: string;
  }): Promise<VehicleUsage[]> => {
    let query = supabase
      .from('vehicle_usage')
      .select('*')
      .order('start_time', { ascending: false });
    
    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // Get usage by ID
  getById: async (id: string): Promise<VehicleUsage | null> => {
    const { data, error } = await supabase
      .from('vehicle_usage')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get daily usage (last 7 days)
  getDailyUsage: async (days: number = 7): Promise<DailyUsageData> => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    // Query daily usage view
    const { data, error } = await supabase
      .from('vehicle_usage_daily')
      .select('*')
      .gte('day', startDate.toISOString().split('T')[0])
      .order('day', { ascending: true });
    
    if (error) throw error;
    
    // Transform to chart format
    const labels = (data || []).map(item => {
      const date = new Date(item.day);
      const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
      return dayNames[date.getDay()];
    });
    
    const usageData = (data || []).map(item => item.active_vehicles || 0);
    
    return {
      labels,
      data: usageData,
    };
  },

  // Get active trips (in progress)
  getActiveTrips: async (): Promise<VehicleUsage[]> => {
    const { data, error } = await supabase
      .from('vehicle_usage')
      .select('*')
      .eq('status', 'in_progress')
      .order('start_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Start a trip
  startTrip: async (usage: VehicleUsageInsert): Promise<VehicleUsage> => {
    const { data, error } = await supabase
      .from('vehicle_usage')
      .insert({
        ...usage,
        status: 'in_progress',
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // End a trip
  endTrip: async (id: string, updates: {
    odometer_end: number;
    end_time?: string;
    notes?: string;
  }): Promise<VehicleUsage> => {
    const { data, error } = await supabase
      .from('vehicle_usage')
      .update({
        ...updates,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create usage record
  create: async (usage: VehicleUsageInsert): Promise<VehicleUsage> => {
    const { data, error } = await supabase
      .from('vehicle_usage')
      .insert(usage)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update usage record
  update: async (id: string, updates: VehicleUsageUpdate): Promise<VehicleUsage> => {
    const { data, error } = await supabase
      .from('vehicle_usage')
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

  // Delete usage record
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('vehicle_usage')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

