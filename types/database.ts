// Database type definitions
// Generated from Supabase schema
// To regenerate: supabase gen types typescript --local > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'user' | 'inspector' | 'manager' | 'executive' | 'admin' | 'driver';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus =
  | 'pending'
  | 'approved_inspector'
  | 'approved_manager'
  | 'ready_for_repair'
  | 'in_progress'
  | 'completed'
  | 'rejected';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: AppRole;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: AppRole;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: AppRole;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          plate: string;
          make: string | null;
          model: string | null;
          type: string | null;
          branch: string | null;
          lat: number | null;
          lng: number | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plate: string;
          make?: string | null;
          model?: string | null;
          type?: string | null;
          branch?: string | null;
          lat?: number | null;
          lng?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plate?: string;
          make?: string | null;
          model?: string | null;
          type?: string | null;
          branch?: string | null;
          lat?: number | null;
          lng?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
      };
      tickets: {
        Row: {
          id: number;
          created_at: string;
          reporter_id: string;
          vehicle_id: string;
          odometer: number | null;
          urgency: UrgencyLevel;
          repair_type: string | null;
          problem_description: string | null;
          status: TicketStatus;
          image_urls: Json;
          garage: string | null;
          inspector_name: string | null;
          manager_name: string | null;
          executive_name: string | null;
          ticket_number: string | null;
          approval_history: Json;
          inspector_signature_url: string | null;
          inspector_signed_at: string | null;
          manager_signature_url: string | null;
          manager_signed_at: string | null;
          executive_signature_url: string | null;
          executive_signed_at: string | null;
          repair_start_date: string | null;
          repair_expected_completion: string | null;
          repair_assigned_to: string | null;
          repair_notes: string | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          reporter_id: string;
          vehicle_id: string;
          odometer?: number | null;
          urgency?: UrgencyLevel;
          repair_type?: string | null;
          problem_description?: string | null;
          status?: TicketStatus;
          image_urls?: Json;
          garage?: string | null;
          inspector_name?: string | null;
          manager_name?: string | null;
          executive_name?: string | null;
          ticket_number?: string | null;
          approval_history?: Json;
          inspector_signature_url?: string | null;
          inspector_signed_at?: string | null;
          manager_signature_url?: string | null;
          manager_signed_at?: string | null;
          executive_signature_url?: string | null;
          executive_signed_at?: string | null;
          repair_start_date?: string | null;
          repair_expected_completion?: string | null;
          repair_assigned_to?: string | null;
          repair_notes?: string | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          reporter_id?: string;
          vehicle_id?: string;
          odometer?: number | null;
          urgency?: UrgencyLevel;
          repair_type?: string | null;
          problem_description?: string | null;
          status?: TicketStatus;
          image_urls?: Json;
          garage?: string | null;
          inspector_name?: string | null;
          manager_name?: string | null;
          executive_name?: string | null;
          ticket_number?: string | null;
          approval_history?: Json;
          inspector_signature_url?: string | null;
          inspector_signed_at?: string | null;
          manager_signature_url?: string | null;
          manager_signed_at?: string | null;
          executive_signature_url?: string | null;
          executive_signed_at?: string | null;
          repair_start_date?: string | null;
          repair_expected_completion?: string | null;
          repair_assigned_to?: string | null;
          repair_notes?: string | null;
        };
      };
      ticket_approvals: {
        Row: {
          id: string;
          ticket_id: number;
          approver_id: string;
          role_at_approval: string | null;
          action: 'approved' | 'rejected';
          comments: string | null;
          signature_url: string | null;
          created_at: string;
          level?: number | null;
          approved_by?: string | null;
        };
        Insert: {
          id?: string;
          ticket_id: number;
          approver_id: string;
          role_at_approval?: string | null;
          action: 'approved' | 'rejected';
          comments?: string | null;
          signature_url?: string | null;
          created_at?: string;
          level?: number | null;
          approved_by?: string | null;
        };
        Update: {
          id?: string;
          ticket_id?: number;
          approver_id?: string;
          role_at_approval?: string | null;
          action?: 'approved' | 'rejected';
          comments?: string | null;
          signature_url?: string | null;
          created_at?: string;
          level?: number | null;
          approved_by?: string | null;
        };
      };
      ticket_costs: {
        Row: {
          id: string;
          ticket_id: number;
          description: string | null;
          cost: number | null;
          category: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: number;
          description?: string | null;
          cost?: number | null;
          category?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: number;
          description?: string | null;
          cost?: number | null;
          category?: string | null;
          note?: string | null;
          created_at?: string;
        };
      };
      vehicle_usage: {
        Row: {
          id: string;
          vehicle_id: string;
          user_id: string;
          odometer_start: number;
          odometer_end: number | null;
          distance_km: number | null;
          start_time: string;
          end_time: string | null;
          duration_hours: number | null;
          purpose: string;
          destination: string | null;
          route: string | null;
          notes: string | null;
          status: string;
          is_manual_correction: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          user_id: string;
          odometer_start: number;
          odometer_end?: number | null;
          purpose: string;
          destination?: string | null;
          route?: string | null;
          notes?: string | null;
          status?: string;
          is_manual_correction?: boolean;
          start_time?: string;
          end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          user_id?: string;
          odometer_start?: number;
          odometer_end?: number | null;
          purpose?: string;
          destination?: string | null;
          route?: string | null;
          notes?: string | null;
          status?: string;
          is_manual_correction?: boolean;
          start_time?: string;
          end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      fuel_records: {
        Row: {
          id: string;
          vehicle_id: string;
          user_id: string;
          odometer: number;
          fuel_type: string;
          liters: number;
          price_per_liter: number;
          total_cost: number | null;
          fuel_station: string | null;
          fuel_station_location: string | null;
          receipt_number: string | null;
          receipt_image_url: string | null;
          distance_since_last_fill: number | null;
          fuel_efficiency: number | null;
          notes: string | null;
          is_full_tank: boolean;
          filled_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          user_id: string;
          odometer: number;
          fuel_type: string;
          liters: number;
          price_per_liter: number;
          fuel_station?: string | null;
          fuel_station_location?: string | null;
          receipt_number?: string | null;
          receipt_image_url?: string | null;
          notes?: string | null;
          is_full_tank?: boolean;
          filled_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          user_id?: string;
          odometer?: number;
          fuel_type?: string;
          liters?: number;
          price_per_liter?: number;
          fuel_station?: string | null;
          fuel_station_location?: string | null;
          receipt_number?: string | null;
          receipt_image_url?: string | null;
          notes?: string | null;
          is_full_tank?: boolean;
          filled_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      maintenance_schedules: {
        Row: {
          id: string;
          vehicle_id: string;
          maintenance_type: string;
          maintenance_name: string;
          description: string | null;
          interval_type: string;
          interval_km: number | null;
          interval_months: number | null;
          last_service_date: string | null;
          last_service_odometer: number | null;
          next_service_date: string | null;
          next_service_odometer: number | null;
          alert_before_km: number;
          alert_before_days: number;
          is_active: boolean;
          priority: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          maintenance_type: string;
          maintenance_name: string;
          description?: string | null;
          interval_type: string;
          interval_km?: number | null;
          interval_months?: number | null;
          last_service_date?: string | null;
          last_service_odometer?: number | null;
          next_service_date?: string | null;
          next_service_odometer?: number | null;
          alert_before_km?: number;
          alert_before_days?: number;
          is_active?: boolean;
          priority?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          maintenance_type?: string;
          maintenance_name?: string;
          description?: string | null;
          interval_type?: string;
          interval_km?: number | null;
          interval_months?: number | null;
          last_service_date?: string | null;
          last_service_odometer?: number | null;
          next_service_date?: string | null;
          next_service_odometer?: number | null;
          alert_before_km?: number;
          alert_before_days?: number;
          is_active?: boolean;
          priority?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      maintenance_history: {
        Row: {
          id: string;
          vehicle_id: string;
          schedule_id: string | null;
          ticket_id: number | null;
          maintenance_type: string;
          maintenance_name: string;
          description: string | null;
          odometer: number;
          performed_at: string;
          cost: number | null;
          labor_cost: number | null;
          parts_cost: number | null;
          performed_by: string | null;
          garage: string | null;
          parts_replaced: string[] | null;
          notes: string | null;
          recommendations: string | null;
          invoice_url: string | null;
          images_urls: string[] | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          schedule_id?: string | null;
          ticket_id?: number | null;
          maintenance_type: string;
          maintenance_name: string;
          description?: string | null;
          odometer: number;
          performed_at?: string;
          cost?: number | null;
          labor_cost?: number | null;
          parts_cost?: number | null;
          performed_by?: string | null;
          garage?: string | null;
          parts_replaced?: string[] | null;
          notes?: string | null;
          recommendations?: string | null;
          invoice_url?: string | null;
          images_urls?: string[] | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          schedule_id?: string | null;
          ticket_id?: number | null;
          maintenance_type?: string;
          maintenance_name?: string;
          description?: string | null;
          odometer?: number;
          performed_at?: string;
          cost?: number | null;
          labor_cost?: number | null;
          parts_cost?: number | null;
          performed_by?: string | null;
          garage?: string | null;
          parts_replaced?: string[] | null;
          notes?: string | null;
          recommendations?: string | null;
          invoice_url?: string | null;
          images_urls?: string[] | null;
          created_at?: string;
          created_by?: string | null;
        };
      };
      vehicle_alerts: {
        Row: {
          id: string;
          vehicle_id: string;
          alert_type: string;
          severity: 'info' | 'warning' | 'critical';
          title: string;
          message: string;
          reference_id: string | null;
          reference_type: string | null;
          is_read: boolean;
          is_resolved: boolean;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          alert_type: string;
          severity?: 'info' | 'warning' | 'critical';
          title: string;
          message: string;
          reference_id?: string | null;
          reference_type?: string | null;
          is_read?: boolean;
          is_resolved?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          alert_type?: string;
          severity?: 'info' | 'warning' | 'critical';
          title?: string;
          message?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          is_read?: boolean;
          is_resolved?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
      };
      trip_logs: {
        Row: {
          id: string;
          vehicle_id: string;
          driver_id: string;
          odometer_start: number | null;
          manual_distance_km: number | null;
          checkout_time: string;
          odometer_end: number | null;
          checkin_time: string | null;
          distance_km: number | null;
          duration_hours: number | null;
          destination: string | null;
          route: string | null;
          notes: string | null;
          status: 'checked_out' | 'checked_in' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          driver_id: string;
          odometer_start?: number | null;
          manual_distance_km?: number | null;
          checkout_time?: string;
          odometer_end?: number | null;
          checkin_time?: string | null;
          distance_km?: number | null;
          duration_hours?: number | null;
          destination?: string | null;
          route?: string | null;
          notes?: string | null;
          status?: 'checked_out' | 'checked_in' | 'cancelled';
          delivery_trip_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          driver_id?: string;
          odometer_start?: number | null;
          manual_distance_km?: number | null;
          checkout_time?: string;
          odometer_end?: number | null;
          checkin_time?: string | null;
          distance_km?: number | null;
          duration_hours?: number | null;
          destination?: string | null;
          route?: string | null;
          notes?: string | null;
          status?: 'checked_out' | 'checked_in' | 'cancelled';
          delivery_trip_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: number;
          created_at: string;
          table_name: string;
          operation: 'INSERT' | 'UPDATE' | 'DELETE';
          record_id: string | null;
          user_id: string | null;
          row_data: Json | null;
          changes: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          table_name: string;
          operation: 'INSERT' | 'UPDATE' | 'DELETE';
          record_id?: string | null;
          user_id?: string | null;
          row_data?: Json | null;
          changes?: Json | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          table_name?: string;
          operation?: 'INSERT' | 'UPDATE' | 'DELETE';
          record_id?: string | null;
          user_id?: string | null;
          row_data?: Json | null;
          changes?: Json | null;
        };
      };
      service_staff: {
        Row: {
          id: string;
          name: string;
          status: 'active' | 'sick' | 'leave' | 'inactive';
          default_team: string | null;
          phone: string | null;
          employee_code: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          status?: 'active' | 'sick' | 'leave' | 'inactive';
          default_team?: string | null;
          phone?: string | null;
          employee_code?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          status?: 'active' | 'sick' | 'leave' | 'inactive';
          default_team?: string | null;
          phone?: string | null;
          employee_code?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      commission_rates: {
        Row: {
          id: string;
          rate_name: string;
          vehicle_type: string | null;
          service_type: string | null;
          rate_per_unit: number;
          is_active: boolean;
          effective_from: string;
          effective_until: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          rate_name: string;
          vehicle_type?: string | null;
          service_type?: string | null;
          rate_per_unit?: number;
          is_active?: boolean;
          effective_from?: string;
          effective_until?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          rate_name?: string;
          vehicle_type?: string | null;
          service_type?: string | null;
          rate_per_unit?: number;
          is_active?: boolean;
          effective_from?: string;
          effective_until?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      delivery_trips: {
        Row: {
          id: string;
          trip_number: string;
          vehicle_id: string;
          driver_id: string | null;
          planned_date: string;
          odometer_start: number | null;
          odometer_end: number | null;
          manual_distance_km: number | null;
          status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          notes: string | null;
          sequence_order: number | null;
          has_item_changes: boolean;
          last_item_change_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          trip_number?: string;
          vehicle_id: string;
          driver_id?: string | null;
          planned_date: string;
          odometer_start?: number | null;
          odometer_end?: number | null;
          manual_distance_km?: number | null;
          status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          notes?: string | null;
          sequence_order?: number | null;
          has_item_changes?: boolean;
          last_item_change_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          trip_number?: string;
          vehicle_id?: string;
          driver_id?: string | null;
          planned_date?: string;
          odometer_start?: number | null;
          odometer_end?: number | null;
          manual_distance_km?: number | null;
          status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          notes?: string | null;
          sequence_order?: number | null;
          has_item_changes?: boolean;
          last_item_change_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      delivery_trip_stores: {
        Row: {
          id: string;
          delivery_trip_id: string;
          store_id: string;
          sequence_order: number;
          arrival_time: string | null;
          departure_time: string | null;
          delivery_status: 'pending' | 'delivered' | 'failed' | 'skipped';
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          delivery_trip_id: string;
          store_id: string;
          sequence_order: number;
          arrival_time?: string | null;
          departure_time?: string | null;
          delivery_status?: 'pending' | 'delivered' | 'failed' | 'skipped';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          delivery_trip_id?: string;
          store_id?: string;
          sequence_order?: number;
          arrival_time?: string | null;
          departure_time?: string | null;
          delivery_status?: 'pending' | 'delivered' | 'failed' | 'skipped';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      delivery_trip_items: {
        Row: {
          id: string;
          delivery_trip_store_id: string;
          product_id: string;
          quantity: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          delivery_trip_store_id: string;
          product_id: string;
          quantity: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          delivery_trip_store_id?: string;
          product_id?: string;
          quantity?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      delivery_trip_item_changes: {
        Row: {
          id: string;
          delivery_trip_id: string;
          delivery_trip_store_id: string | null;
          delivery_trip_item_id: string | null;
          product_id: string | null;
          change_type: 'add' | 'update' | 'remove';
          old_quantity: number | null;
          new_quantity: number | null;
          reason: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          delivery_trip_id: string;
          delivery_trip_store_id?: string | null;
          delivery_trip_item_id?: string | null;
          product_id?: string | null;
          change_type: 'add' | 'update' | 'remove';
          old_quantity?: number | null;
          new_quantity?: number | null;
          reason?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          delivery_trip_id?: string;
          delivery_trip_store_id?: string | null;
          delivery_trip_item_id?: string | null;
          product_id?: string | null;
          change_type?: 'add' | 'update' | 'remove';
          old_quantity?: number | null;
          new_quantity?: number | null;
          reason?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
      };
      delivery_trip_crews: {
        Row: {
          id: string;
          delivery_trip_id: string;
          staff_id: string;
          role: 'driver' | 'helper';
          status: 'active' | 'removed' | 'replaced';
          start_at: string;
          end_at: string | null;
          replaced_by_staff_id: string | null;
          reason_for_change: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          delivery_trip_id: string;
          staff_id: string;
          role: 'driver' | 'helper';
          status?: 'active' | 'removed' | 'replaced';
          start_at?: string;
          end_at?: string | null;
          replaced_by_staff_id?: string | null;
          reason_for_change?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          delivery_trip_id?: string;
          staff_id?: string;
          role?: 'driver' | 'helper';
          status?: 'active' | 'removed' | 'replaced';
          start_at?: string;
          end_at?: string | null;
          replaced_by_staff_id?: string | null;
          reason_for_change?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      commission_logs: {
        Row: {
          id: string;
          delivery_trip_id: string;
          staff_id: string;
          total_items_delivered: number;
          rate_applied: number;
          commission_amount: number;
          work_percentage: number;
          actual_commission: number;
          calculation_date: string;
          calculated_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          delivery_trip_id: string;
          staff_id: string;
          total_items_delivered?: number;
          rate_applied: number;
          commission_amount: number;
          work_percentage?: number;
          actual_commission: number;
          calculation_date?: string;
          calculated_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          delivery_trip_id?: string;
          staff_id?: string;
          total_items_delivered?: number;
          rate_applied?: number;
          commission_amount?: number;
          work_percentage?: number;
          actual_commission?: number;
          calculation_date?: string;
          calculated_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      vehicle_dashboard: {
        Row: {
          id: string;
          plate: string;
          make: string | null;
          model: string | null;
          type: string | null;
          branch: string | null;
          current_odometer: number;
          usage_status: string | null;
          trips_last_30_days: number;
          last_fuel_date: string | null;
          avg_fuel_efficiency: number | null;
          fuel_cost_last_30_days: number | null;
          last_maintenance_date: string | null;
          active_schedules: number;
          upcoming_maintenance_count: number;
          unresolved_alerts_count: number;
          critical_alerts_count: number;
          maintenance_cost_last_30_days: number | null;
        };
      };
      fuel_efficiency_summary: {
        Row: {
          vehicle_id: string;
          plate: string;
          make: string | null;
          model: string | null;
          month: string;
          fill_count: number;
          total_liters: number | null;
          total_cost: number | null;
          avg_efficiency: number | null;
          min_efficiency: number | null;
          max_efficiency: number | null;
        };
      };
      vehicle_usage_summary: {
        Row: {
          vehicle_id: string;
          plate: string;
          make: string | null;
          model: string | null;
          month: string;
          trip_count: number;
          total_distance: number | null;
          avg_distance: number | null;
          total_hours: number | null;
          avg_hours: number | null;
        };
      };
      vehicle_usage_daily: {
        Row: {
          day: string;
          active_vehicles: number;
          total_trips: number;
          total_distance: number | null;
          avg_distance: number | null;
          total_hours: number | null;
        };
      };
      vehicles_with_status: {
        Row: {
          id: string;
          plate: string;
          make: string | null;
          model: string | null;
          type: string | null;
          branch: string | null;
          lat: number | null;
          lng: number | null;
          created_at: string;
          status: string;
          trips_last_30_days: number;
          last_fuel_efficiency: number | null;
        };
      };
      tickets_with_relations: {
        Row: {
          id: number;
          created_at: string;
          reporter_id: string;
          vehicle_id: string;
          odometer: number | null;
          urgency: UrgencyLevel;
          repair_type: string | null;
          problem_description: string | null;
          status: TicketStatus;
          image_urls: Json;
          vehicle_plate: string;
          make: string | null;
          model: string | null;
          vehicle_type: string | null;
          branch: string | null;
          vehicle_image_url: string | null;
          reporter_email: string | null;
          reporter_name: string | null;
          reporter_role: AppRole;
          reporter_avatar_url: string | null;
        };
      };
    };
    Functions: {
      get_vehicle_status: {
        Args: {
          p_vehicle_id: string;
        };
        Returns: string;
      };
      check_maintenance_alerts: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      calculate_fuel_efficiency: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      update_maintenance_schedule: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
  };
}

