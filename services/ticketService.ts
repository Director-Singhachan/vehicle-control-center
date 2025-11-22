// Ticket Service - CRUD operations for tickets
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Ticket = Database['public']['Tables']['tickets']['Row'];
type TicketInsert = Database['public']['Tables']['tickets']['Insert'];
type TicketUpdate = Database['public']['Tables']['tickets']['Update'];
type TicketWithRelations = Database['public']['Views']['tickets_with_relations']['Row'];

export interface TicketCost {
  id: string;
  ticket_id: number;
  description: string | null;
  cost: number | null;
  category: string | null;
  note: string | null;
  created_at: string;
}

export const ticketService = {
  // Get all tickets
  getAll: async (filters?: {
    status?: string[];
    vehicle_id?: string;
    reporter_id?: string;
  }): Promise<Ticket[]> => {
    let query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.reporter_id) {
      query = query.eq('reporter_id', filters.reporter_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Get tickets with relations (using view)
  getWithRelations: async (filters?: {
    status?: string[];
    vehicle_id?: string;
  }): Promise<TicketWithRelations[]> => {
    try {
      let query = supabase
        .from('tickets_with_relations')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters?.vehicle_id) {
        query = query.eq('vehicle_id', filters.vehicle_id);
      }

      const { data, error } = await query;

      if (error) {
        // Check for connection errors
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          throw new Error('Connection failed. If the problem persists, please check your internet connection or VPN');
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      // Re-throw with better error message
      if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
        throw new Error('Connection failed. If the problem persists, please check your internet connection or VPN');
      }
      throw err;
    }
  },

  // Get ticket by ID
  getById: async (id: number): Promise<Ticket | null> => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Get urgent tickets count
  getUrgentCount: async (): Promise<number> => {
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('urgency', ['high', 'critical'])
      .in('status', ['pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress']);

    if (error) throw error;
    return count || 0;
  },

  // Get recent tickets
  getRecentTickets: async (limit: number = 10): Promise<TicketWithRelations[]> => {
    const { data, error } = await supabase
      .from('tickets_with_relations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Create new ticket
  create: async (ticket: TicketInsert): Promise<Ticket> => {
    const { data, error } = await supabase
      .from('tickets')
      .insert(ticket)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update ticket
  update: async (id: number, updates: TicketUpdate): Promise<Ticket> => {
    const { data, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete ticket
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get ticket costs
  getCosts: async (ticketId: number): Promise<TicketCost[]> => {
    const { data, error } = await supabase
      .from('ticket_costs')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Add ticket cost
  addCost: async (cost: {
    ticket_id: number;
    description?: string;
    cost?: number;
    category?: string;
    note?: string;
  }): Promise<TicketCost> => {
    const { data, error } = await supabase
      .from('ticket_costs')
      .insert(cost)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Approve ticket with password verification
  approveTicket: async (
    ticketId: string,
    level: number,
    userId: string,
    password: string,
    comment?: string,
    nextStatus?: string
  ): Promise<void> => {
    // 1. Verify password
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email: (await supabase.auth.getUser()).data.user?.email || '',
      password: password,
    });

    if (authError || !user) {
      throw new Error('รหัสผ่านไม่ถูกต้อง');
    }

    // 2. Create approval record
    const { error: approvalError } = await supabase
      .from('ticket_approvals')
      .insert({
        ticket_id: ticketId,
        level: level,
        approved_by: userId,
        comments: comment,
        user_agent: navigator.userAgent,
        // ip_address is handled by Supabase automatically if configured, 
        // or we can't reliably get it from client side without an edge function
      });

    if (approvalError) throw approvalError;

    // 3. Update ticket status if needed
    if (nextStatus) {
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: nextStatus })
        .eq('id', ticketId);

      if (updateError) throw updateError;
    }
  },
};

