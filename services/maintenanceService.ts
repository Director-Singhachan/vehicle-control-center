// Maintenance Service - CRUD operations for maintenance
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type MaintenanceSchedule = Database['public']['Tables']['maintenance_schedules']['Row'];
type MaintenanceScheduleInsert = Database['public']['Tables']['maintenance_schedules']['Insert'];
type MaintenanceScheduleUpdate = Database['public']['Tables']['maintenance_schedules']['Update'];
type MaintenanceHistory = Database['public']['Tables']['maintenance_history']['Row'];
type MaintenanceHistoryInsert = Database['public']['Tables']['maintenance_history']['Insert'];
type MaintenanceHistoryUpdate = Database['public']['Tables']['maintenance_history']['Update'];

export const maintenanceService = {
  // ========== Maintenance Schedules ==========

  // Get all maintenance schedules
  getSchedules: async (filters?: {
    vehicle_id?: string;
    is_active?: boolean;
  }): Promise<MaintenanceSchedule[]> => {
    let query = supabase
      .from('maintenance_schedules')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Get schedule by ID
  getScheduleById: async (id: string): Promise<MaintenanceSchedule | null> => {
    const { data, error } = await supabase
      .from('maintenance_schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create maintenance schedule
  createSchedule: async (schedule: MaintenanceScheduleInsert): Promise<MaintenanceSchedule> => {
    const { data, error } = await supabase
      .from('maintenance_schedules')
      .insert(schedule)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update maintenance schedule
  updateSchedule: async (id: string, updates: MaintenanceScheduleUpdate): Promise<MaintenanceSchedule> => {
    const { data, error } = await (supabase.from('maintenance_schedules') as any).update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete maintenance schedule
  deleteSchedule: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('maintenance_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ========== Maintenance History ==========

  // Get all maintenance history
  getHistory: async (filters?: {
    vehicle_id?: string;
    schedule_id?: string;
    ticket_id?: number;
  }): Promise<MaintenanceHistory[]> => {
    let query = supabase
      .from('maintenance_history')
      .select('*')
      .order('performed_at', { ascending: false });

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.schedule_id) {
      query = query.eq('schedule_id', filters.schedule_id);
    }
    if (filters?.ticket_id) {
      query = query.eq('ticket_id', filters.ticket_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Get history by ID
  getHistoryById: async (id: string): Promise<MaintenanceHistory | null> => {
    const { data, error } = await supabase
      .from('maintenance_history')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create maintenance history
  createHistory: async (history: MaintenanceHistoryInsert): Promise<MaintenanceHistory> => {
    const { data, error } = await supabase
      .from('maintenance_history')
      .insert(history)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update maintenance history
  updateHistory: async (id: string, updates: MaintenanceHistoryUpdate): Promise<MaintenanceHistory> => {
    const { data, error } = await (supabase.from('maintenance_history') as any).update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete maintenance history
  deleteHistory: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('maintenance_history')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Check maintenance alerts
  checkAlerts: async (): Promise<void> => {
    const { error } = await supabase.rpc('check_maintenance_alerts');
    if (error) throw error;
  },

  // Create history from ticket
  createHistoryFromTicket: async (ticket: any, costs: any[] = []): Promise<MaintenanceHistory> => {
    // Get current user ID for RLS policy compliance
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่');
    }

    const totalCost = costs.reduce((sum, item) => sum + (item.cost || 0), 0);

    const historyData: MaintenanceHistoryInsert = {
      vehicle_id: ticket.vehicle_id,
      ticket_id: ticket.id,
      maintenance_type: 'repair', // Default to repair for tickets
      maintenance_name: ticket.repair_type || 'ซ่อมบำรุงตามตั๋ว',
      description: ticket.problem_description,
      odometer: ticket.odometer || 0,
      performed_at: new Date().toISOString(),
      cost: totalCost,
      garage: ticket.garage,
      notes: ticket.repair_notes,
      performed_by: ticket.repair_assigned_to, // Use ID for now, or fetch name if needed
      created_by: user.id, // Use current user ID to comply with RLS policy
    };

    return await maintenanceService.createHistory(historyData);
  },
};

