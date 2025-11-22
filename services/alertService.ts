// Alert Service - Operations for vehicle_alerts
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type VehicleAlert = Database['public']['Tables']['vehicle_alerts']['Row'];
type VehicleAlertInsert = Database['public']['Tables']['vehicle_alerts']['Insert'];
type VehicleAlertUpdate = Database['public']['Tables']['vehicle_alerts']['Update'];

export const alertService = {
  // Get all alerts
  getAll: async (filters?: {
    vehicle_id?: string;
    is_read?: boolean;
    is_resolved?: boolean;
    severity?: 'info' | 'warning' | 'critical';
  }): Promise<VehicleAlert[]> => {
    let query = supabase
      .from('vehicle_alerts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.is_read !== undefined) {
      query = query.eq('is_read', filters.is_read);
    }
    if (filters?.is_resolved !== undefined) {
      query = query.eq('is_resolved', filters.is_resolved);
    }
    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // Get unread alerts
  getUnread: async (vehicleId?: string): Promise<VehicleAlert[]> => {
    let query = supabase
      .from('vehicle_alerts')
      .select('*')
      .eq('is_read', false)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });
    
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // Get critical alerts
  getCritical: async (): Promise<VehicleAlert[]> => {
    const { data, error } = await supabase
      .from('vehicle_alerts')
      .select('*')
      .eq('severity', 'critical')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get alert by ID
  getById: async (id: string): Promise<VehicleAlert | null> => {
    const { data, error } = await supabase
      .from('vehicle_alerts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create alert
  create: async (alert: VehicleAlertInsert): Promise<VehicleAlert> => {
    const { data, error } = await supabase
      .from('vehicle_alerts')
      .insert(alert)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Mark alert as read
  markAsRead: async (id: string): Promise<VehicleAlert> => {
    const { data, error } = await supabase
      .from('vehicle_alerts')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Mark alert as resolved
  markAsResolved: async (id: string, resolvedBy?: string): Promise<VehicleAlert> => {
    const { data, error } = await supabase
      .from('vehicle_alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy || null,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update alert
  update: async (id: string, updates: VehicleAlertUpdate): Promise<VehicleAlert> => {
    const { data, error } = await supabase
      .from('vehicle_alerts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete alert
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('vehicle_alerts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

