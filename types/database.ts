export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      order_delivery_trip_allocations: {
        Row: {
          id: string
          order_id: string
          delivery_trip_id: string
          order_item_id: string
          allocated_quantity: number
          delivered_quantity: number
          status: 'planned' | 'in_delivery' | 'delivered' | 'cancelled'
          sequence_no: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          delivery_trip_id: string
          order_item_id: string
          allocated_quantity?: number
          delivered_quantity?: number
          status?: 'planned' | 'in_delivery' | 'delivered' | 'cancelled'
          sequence_no?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          delivery_trip_id?: string
          order_item_id?: string
          allocated_quantity?: number
          delivered_quantity?: number
          status?: 'planned' | 'in_delivery' | 'delivered' | 'cancelled'
          sequence_no?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odta_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odta_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odta_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_trip_recommendations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          ai_model_version: string | null
          confidence_score: number | null
          created_at: string | null
          created_by: string | null
          estimated_distance_km: number | null
          estimated_duration_hours: number | null
          id: string
          input_hash: string
          planned_date: string
          reasoning: string | null
          recommended_trips: Json
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_products: Json
          requested_stores: Json
          status: string | null
          total_vehicles_needed: number | null
          utilization_scores: Json | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          ai_model_version?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          estimated_distance_km?: number | null
          estimated_duration_hours?: number | null
          id?: string
          input_hash: string
          planned_date: string
          reasoning?: string | null
          recommended_trips: Json
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_products: Json
          requested_stores: Json
          status?: string | null
          total_vehicles_needed?: number | null
          utilization_scores?: Json | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          ai_model_version?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          estimated_distance_km?: number | null
          estimated_duration_hours?: number | null
          id?: string
          input_hash?: string
          planned_date?: string
          reasoning?: string | null
          recommended_trips?: Json
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_products?: Json
          requested_stores?: Json
          status?: string | null
          total_vehicles_needed?: number | null
          utilization_scores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_trip_recommendations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_trip_recommendations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_trip_recommendations_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          changes: Json | null
          created_at: string
          id: number
          operation: string
          record_id: string | null
          row_data: Json | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          changes?: Json | null
          created_at?: string
          id?: number
          operation: string
          record_id?: string | null
          row_data?: Json | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          changes?: Json | null
          created_at?: string
          id?: number
          operation?: string
          record_id?: string | null
          row_data?: Json | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      commission_logs: {
        Row: {
          actual_commission: number
          calculated_by: string | null
          calculation_date: string
          commission_amount: number
          created_at: string
          delivery_trip_id: string
          id: string
          notes: string | null
          rate_applied: number
          staff_id: string
          total_items_delivered: number
          work_percentage: number | null
        }
        Insert: {
          actual_commission: number
          calculated_by?: string | null
          calculation_date?: string
          commission_amount: number
          created_at?: string
          delivery_trip_id: string
          id?: string
          notes?: string | null
          rate_applied: number
          staff_id: string
          total_items_delivered?: number
          work_percentage?: number | null
        }
        Update: {
          actual_commission?: number
          calculated_by?: string | null
          calculation_date?: string
          commission_amount?: number
          created_at?: string
          delivery_trip_id?: string
          id?: string
          notes?: string | null
          rate_applied?: number
          staff_id?: string
          total_items_delivered?: number
          work_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_logs_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "commission_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "commission_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "commission_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      commission_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          notes: string | null
          rate_name: string
          rate_per_unit: number
          service_type: string | null
          updated_at: string
          updated_by: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rate_name: string
          rate_per_unit?: number
          service_type?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rate_name?: string
          rate_per_unit?: number
          service_type?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_allocation_rules: {
        Row: {
          allocation_basis: string
          cost_category: string
          created_at: string
          created_by: string | null
          dimension: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          notes: string | null
          rule_config: Json | null
          updated_at: string
        }
        Insert: {
          allocation_basis: string
          cost_category: string
          created_at?: string
          created_by?: string | null
          dimension: string
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rule_config?: Json | null
          updated_at?: string
        }
        Update: {
          allocation_basis?: string
          cost_category?: string
          created_at?: string
          created_by?: string | null
          dimension?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rule_config?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_tiers: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          discount_percent: number | null
          display_order: number | null
          id: string
          is_active: boolean | null
          min_order_amount: number | null
          tier_code: string
          tier_name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          min_order_amount?: number | null
          tier_code: string
          tier_name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          min_order_amount?: number | null
          tier_code?: string
          tier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_stats_by_day_product: {
        Row: {
          created_at: string
          product_id: string
          stat_date: string
          total_quantity: number
          total_stores: number
          total_trips: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          product_id: string
          stat_date: string
          total_quantity?: number
          total_stores?: number
          total_trips?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          product_id?: string
          stat_date?: string
          total_quantity?: number
          total_stores?: number
          total_trips?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stats_by_day_product_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "delivery_stats_by_day_product_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stats_by_day_store: {
        Row: {
          created_at: string
          stat_date: string
          store_id: string
          total_items: number
          total_quantity: number
          total_trips: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          stat_date: string
          store_id: string
          total_items?: number
          total_quantity?: number
          total_trips?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          stat_date?: string
          store_id?: string
          total_items?: number
          total_quantity?: number
          total_trips?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stats_by_day_store_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stats_by_day_store_product: {
        Row: {
          created_at: string
          product_id: string
          stat_date: string
          store_id: string
          total_deliveries: number
          total_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          product_id: string
          stat_date: string
          store_id: string
          total_deliveries?: number
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          product_id?: string
          stat_date?: string
          store_id?: string
          total_deliveries?: number
          total_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stats_by_day_store_product_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "delivery_stats_by_day_store_product_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stats_by_day_store_product_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stats_by_day_vehicle: {
        Row: {
          created_at: string
          stat_date: string
          total_distance_km: number
          total_items: number
          total_quantity: number
          total_stores: number
          total_trips: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          stat_date: string
          total_distance_km?: number
          total_items?: number
          total_quantity?: number
          total_stores?: number
          total_trips?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          stat_date?: string
          total_distance_km?: number
          total_items?: number
          total_quantity?: number
          total_stores?: number
          total_trips?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stats_by_day_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stats_by_day_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stats_by_day_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_trip_crews: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_trip_id: string
          end_at: string | null
          id: string
          notes: string | null
          reason_for_change: string | null
          replaced_by_staff_id: string | null
          role: string
          staff_id: string
          start_at: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_trip_id: string
          end_at?: string | null
          id?: string
          notes?: string | null
          reason_for_change?: string | null
          replaced_by_staff_id?: string | null
          role: string
          staff_id: string
          start_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_trip_id?: string
          end_at?: string | null
          id?: string
          notes?: string | null
          reason_for_change?: string | null
          replaced_by_staff_id?: string | null
          role?: string
          staff_id?: string
          start_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_crews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_replaced_by_staff_id_fkey"
            columns: ["replaced_by_staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_replaced_by_staff_id_fkey"
            columns: ["replaced_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_trip_item_changes: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          delivery_trip_id: string
          delivery_trip_item_id: string | null
          delivery_trip_store_id: string | null
          id: string
          new_quantity: number | null
          old_quantity: number | null
          product_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          delivery_trip_id: string
          delivery_trip_item_id?: string | null
          delivery_trip_store_id?: string | null
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          product_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          delivery_trip_id?: string
          delivery_trip_item_id?: string | null
          delivery_trip_store_id?: string | null
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          product_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_item_changes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_item_id_fkey"
            columns: ["delivery_trip_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_trip_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_item_id_fkey"
            columns: ["delivery_trip_item_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_delivery_trip_store_id_fkey"
            columns: ["delivery_trip_store_id"]
            isOneToOne: false
            referencedRelation: "delivery_trip_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "delivery_trip_item_changes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_trip_items: {
        Row: {
          created_at: string
          delivery_trip_id: string
          delivery_trip_store_id: string
          id: string
          is_bonus: boolean
          notes: string | null
          product_id: string
          quantity: number
          quantity_picked_up_at_store: number
          selected_pallet_config_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_trip_id: string
          delivery_trip_store_id: string
          id?: string
          is_bonus?: boolean
          notes?: string | null
          product_id: string
          quantity?: number
          quantity_picked_up_at_store?: number
          selected_pallet_config_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_trip_id?: string
          delivery_trip_store_id?: string
          id?: string
          is_bonus?: boolean
          notes?: string | null
          product_id?: string
          quantity?: number
          quantity_picked_up_at_store?: number
          selected_pallet_config_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_items_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_items_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_items_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_items_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_items_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_items_delivery_trip_store_id_fkey"
            columns: ["delivery_trip_store_id"]
            isOneToOne: false
            referencedRelation: "delivery_trip_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "delivery_trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_items_selected_pallet_config_id_fkey"
            columns: ["selected_pallet_config_id"]
            isOneToOne: false
            referencedRelation: "product_pallet_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_trip_stores: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_status: string
          delivery_trip_id: string
          id: string
          invoice_status: string | null
          notes: string | null
          sequence_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          delivery_trip_id: string
          id?: string
          invoice_status?: string | null
          notes?: string | null
          sequence_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          delivery_trip_id?: string
          id?: string
          invoice_status?: string | null
          notes?: string | null
          sequence_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_stores_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_stores_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_stores_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_stores_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_stores_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_trip_vehicle_changes: {
        Row: {
          changed_at: string
          changed_by: string
          delivery_trip_id: string
          id: string
          new_vehicle_id: string
          old_vehicle_id: string
          reason: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          delivery_trip_id: string
          id?: string
          new_vehicle_id: string
          old_vehicle_id: string
          reason: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          delivery_trip_id?: string
          id?: string
          new_vehicle_id?: string
          old_vehicle_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_vehicle_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_new_vehicle_id_fkey"
            columns: ["new_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_new_vehicle_id_fkey"
            columns: ["new_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_new_vehicle_id_fkey"
            columns: ["new_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_old_vehicle_id_fkey"
            columns: ["old_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_old_vehicle_id_fkey"
            columns: ["old_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_vehicle_changes_old_vehicle_id_fkey"
            columns: ["old_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_trips: {
        Row: {
          actual_distance_km: number | null
          actual_duration_hours: number | null
          actual_pallets_used: number | null
          actual_weight_kg: number | null
          branch: string | null
          created_at: string
          created_by: string | null
          driver_id: string | null
          edit_reason: string | null
          had_packing_issues: boolean | null
          has_item_changes: boolean
          has_sales_data_issue: boolean
          id: string
          last_item_change_at: string | null
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          packing_efficiency_score: number | null
          packing_issues_notes: string | null
          planned_date: string
          service_type: string
          sequence_order: number
          space_utilization_percent: number | null
          status: string
          trip_end_date: string | null
          trip_number: string | null
          trip_revenue: number | null
          trip_start_date: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          actual_distance_km?: number | null
          actual_duration_hours?: number | null
          actual_pallets_used?: number | null
          actual_weight_kg?: number | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          edit_reason?: string | null
          had_packing_issues?: boolean | null
          has_item_changes?: boolean
          has_sales_data_issue?: boolean
          id?: string
          last_item_change_at?: string | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          packing_efficiency_score?: number | null
          packing_issues_notes?: string | null
          planned_date: string
          service_type?: string
          sequence_order?: number
          space_utilization_percent?: number | null
          status?: string
          trip_end_date?: string | null
          trip_number?: string | null
          trip_revenue?: number | null
          trip_start_date?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          actual_distance_km?: number | null
          actual_duration_hours?: number | null
          actual_pallets_used?: number | null
          actual_weight_kg?: number | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          edit_reason?: string | null
          had_packing_issues?: boolean | null
          has_item_changes?: boolean
          has_sales_data_issue?: boolean
          id?: string
          last_item_change_at?: string | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          packing_efficiency_score?: number | null
          packing_issues_notes?: string | null
          planned_date?: string
          service_type?: string
          sequence_order?: number
          space_utilization_percent?: number | null
          status?: string
          trip_end_date?: string | null
          trip_number?: string | null
          trip_revenue?: number | null
          trip_start_date?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_records: {
        Row: {
          created_at: string | null
          distance_since_last_fill: number | null
          filled_at: string
          fuel_efficiency: number | null
          fuel_station: string | null
          fuel_station_location: string | null
          fuel_type: string
          id: string
          is_full_tank: boolean | null
          liters: number
          notes: string | null
          odometer: number
          price_per_liter: number
          receipt_image_url: string | null
          receipt_number: string | null
          total_cost: number | null
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          distance_since_last_fill?: number | null
          filled_at?: string
          fuel_efficiency?: number | null
          fuel_station?: string | null
          fuel_station_location?: string | null
          fuel_type: string
          id?: string
          is_full_tank?: boolean | null
          liters: number
          notes?: string | null
          odometer: number
          price_per_liter: number
          receipt_image_url?: string | null
          receipt_number?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          distance_since_last_fill?: number | null
          filled_at?: string
          fuel_efficiency?: number | null
          fuel_station?: string | null
          fuel_station_location?: string | null
          fuel_type?: string
          id?: string
          is_full_tank?: boolean | null
          liters?: number
          notes?: string | null
          odometer?: number
          price_per_liter?: number
          receipt_image_url?: string | null
          receipt_number?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          available_quantity: number | null
          created_at: string | null
          id: string
          last_updated_at: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          product_id: string
          quantity: number | null
          reserved_quantity: number | null
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string | null
          id?: string
          last_updated_at?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id: string
          quantity?: number | null
          reserved_quantity?: number | null
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          available_quantity?: number | null
          created_at?: string | null
          id?: string
          last_updated_at?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id?: string
          quantity?: number | null
          reserved_quantity?: number | null
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string | null
          quantity: number
          ref_code: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string | null
          quantity: number
          ref_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string | null
          quantity?: number
          ref_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_moving_avg_costs: {
        Row: {
          avg_unit_cost: number
          basis_qty: number
          product_id: string
          total_cost_value: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          avg_unit_cost?: number
          basis_qty?: number
          product_id: string
          total_cost_value?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          avg_unit_cost?: number
          basis_qty?: number
          product_id?: string
          total_cost_value?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_moving_avg_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_moving_avg_costs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string
          purchase_receipt_id: string
          quantity: number
          unit: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_receipt_id: string
          quantity: number
          unit?: string | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_receipt_id?: string
          quantity?: number
          unit?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_purchase_receipt_id_fkey"
            columns: ["purchase_receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_ref: string | null
          notes: string | null
          posted_at: string | null
          receipt_date: string
          status: string
          supplier_name: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          posted_at?: string | null
          receipt_date?: string
          status?: string
          supplier_name?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          posted_at?: string | null
          receipt_date?: string
          status?: string
          supplier_name?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_history: {
        Row: {
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          garage: string | null
          id: string
          images_urls: string[] | null
          invoice_url: string | null
          labor_cost: number | null
          maintenance_name: string
          maintenance_type: string
          notes: string | null
          odometer: number
          parts_cost: number | null
          parts_replaced: string[] | null
          performed_at: string
          performed_by: string | null
          recommendations: string | null
          schedule_id: string | null
          ticket_id: number | null
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          garage?: string | null
          id?: string
          images_urls?: string[] | null
          invoice_url?: string | null
          labor_cost?: number | null
          maintenance_name: string
          maintenance_type: string
          notes?: string | null
          odometer: number
          parts_cost?: number | null
          parts_replaced?: string[] | null
          performed_at?: string
          performed_by?: string | null
          recommendations?: string | null
          schedule_id?: string | null
          ticket_id?: number | null
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          garage?: string | null
          id?: string
          images_urls?: string[] | null
          invoice_url?: string | null
          labor_cost?: number | null
          maintenance_name?: string
          maintenance_type?: string
          notes?: string | null
          odometer?: number
          parts_cost?: number | null
          parts_replaced?: string[] | null
          performed_at?: string
          performed_by?: string | null
          recommendations?: string | null
          schedule_id?: string | null
          ticket_id?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_relations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          alert_before_days: number | null
          alert_before_km: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          interval_km: number | null
          interval_months: number | null
          interval_type: string
          is_active: boolean | null
          last_service_date: string | null
          last_service_odometer: number | null
          maintenance_name: string
          maintenance_type: string
          next_service_date: string | null
          next_service_odometer: number | null
          priority: string | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          alert_before_days?: number | null
          alert_before_km?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          interval_type: string
          is_active?: boolean | null
          last_service_date?: string | null
          last_service_odometer?: number | null
          maintenance_name: string
          maintenance_type: string
          next_service_date?: string | null
          next_service_odometer?: number | null
          priority?: string | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          alert_before_days?: number | null
          alert_before_km?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          interval_type?: string
          is_active?: boolean | null
          last_service_date?: string | null
          last_service_odometer?: number | null
          maintenance_name?: string
          maintenance_type?: string
          next_service_date?: string | null
          next_service_odometer?: number | null
          priority?: string | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          channel: string
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          message: string
          payload: Json | null
          pdf_data: string | null
          sent_at: string | null
          status: string
          target_user_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          message: string
          payload?: Json | null
          pdf_data?: string | null
          sent_at?: string | null
          status?: string
          target_user_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          message?: string
          payload?: Json | null
          pdf_data?: string | null
          sent_at?: string | null
          status?: string
          target_user_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string | null
          enable_line: boolean
          enable_telegram: boolean
          id: string
          line_pending_pdf_path: string | null
          line_pending_pdf_uploaded_at: string | null
          line_pending_ticket_number: string | null
          line_token: string | null
          line_user_id: string | null
          notify_fuel_refill: boolean
          notify_long_checkout: boolean
          notify_maintenance_due: boolean
          notify_ticket_approval: boolean
          notify_ticket_closed: boolean
          notify_ticket_created: boolean
          notify_trip_finished: boolean
          notify_trip_started: boolean
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enable_line?: boolean
          enable_telegram?: boolean
          id?: string
          line_pending_pdf_path?: string | null
          line_pending_pdf_uploaded_at?: string | null
          line_pending_ticket_number?: string | null
          line_token?: string | null
          line_user_id?: string | null
          notify_fuel_refill?: boolean
          notify_long_checkout?: boolean
          notify_maintenance_due?: boolean
          notify_ticket_approval?: boolean
          notify_ticket_closed?: boolean
          notify_ticket_created?: boolean
          notify_trip_finished?: boolean
          notify_trip_started?: boolean
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enable_line?: boolean
          enable_telegram?: boolean
          id?: string
          line_pending_pdf_path?: string | null
          line_pending_pdf_uploaded_at?: string | null
          line_pending_ticket_number?: string | null
          line_token?: string | null
          line_user_id?: string | null
          notify_fuel_refill?: boolean
          notify_long_checkout?: boolean
          notify_maintenance_due?: boolean
          notify_ticket_approval?: boolean
          notify_ticket_closed?: boolean
          notify_ticket_created?: boolean
          notify_trip_finished?: boolean
          notify_trip_started?: boolean
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          fulfillment_method: string
          id: string
          is_bonus: boolean
          line_total: number
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          quantity_delivered: number
          quantity_fulfilled_prior_bill: number
          quantity_picked_up_at_store: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          fulfillment_method?: string
          id?: string
          is_bonus?: boolean
          line_total: number
          notes?: string | null
          order_id: string
          product_id: string
          quantity: number
          quantity_delivered?: number
          quantity_fulfilled_prior_bill?: number
          quantity_picked_up_at_store?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          fulfillment_method?: string
          id?: string
          is_bonus?: boolean
          line_total?: number
          notes?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          quantity_delivered?: number
          quantity_fulfilled_prior_bill?: number
          quantity_picked_up_at_store?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          order_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_time_slot: string | null
          delivery_trip_id: string | null
          discount_amount: number | null
          exclude_from_vehicle_revenue_rollup: boolean
          id: string
          internal_notes: string | null
          notes: string | null
          order_date: string
          order_number: string | null
          payment_status: string | null
          related_prior_order_id: string | null
          replaces_sml_doc_no: string | null
          status: string
          store_id: string
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          updated_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_time_slot?: string | null
          delivery_trip_id?: string | null
          discount_amount?: number | null
          exclude_from_vehicle_revenue_rollup?: boolean
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string | null
          payment_status?: string | null
          related_prior_order_id?: string | null
          replaces_sml_doc_no?: string | null
          status?: string
          store_id: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_time_slot?: string | null
          delivery_trip_id?: string | null
          discount_amount?: number | null
          exclude_from_vehicle_revenue_rollup?: boolean
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string | null
          payment_status?: string | null
          related_prior_order_id?: string | null
          replaces_sml_doc_no?: string | null
          status?: string
          store_id?: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_related_prior_order_id_fkey"
            columns: ["related_prior_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      pallets: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          height_cm: number
          id: string
          is_active: boolean | null
          items_per_pallet: number | null
          length_cm: number
          max_stack_count: number | null
          max_stack_height_cm: number | null
          max_weight_per_pallet_kg: number | null
          pallet_code: string
          pallet_layout_config: Json | null
          pallet_name: string
          updated_at: string | null
          updated_by: string | null
          weight_kg: number | null
          width_cm: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          height_cm?: number
          id?: string
          is_active?: boolean | null
          items_per_pallet?: number | null
          length_cm: number
          max_stack_count?: number | null
          max_stack_height_cm?: number | null
          max_weight_per_pallet_kg?: number | null
          pallet_code: string
          pallet_layout_config?: Json | null
          pallet_name: string
          updated_at?: string | null
          updated_by?: string | null
          weight_kg?: number | null
          width_cm: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          height_cm?: number
          id?: string
          is_active?: boolean | null
          items_per_pallet?: number | null
          length_cm?: number
          max_stack_count?: number | null
          max_stack_height_cm?: number | null
          max_weight_per_pallet_kg?: number | null
          pallet_code?: string
          pallet_layout_config?: Json | null
          pallet_name?: string
          updated_at?: string | null
          updated_by?: string | null
          weight_kg?: number | null
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "pallets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pnl_fleet: {
        Row: {
          calculated_at: string
          calculation_batch_id: string | null
          created_at: string
          flags: Json | null
          id: string
          margin_percent: number | null
          period_end: string
          period_start: string
          profit: number
          scope_key: string
          scope_type: string
          total_cost: number
          total_revenue: number
        }
        Insert: {
          calculated_at?: string
          calculation_batch_id?: string | null
          created_at?: string
          flags?: Json | null
          id?: string
          margin_percent?: number | null
          period_end: string
          period_start: string
          profit?: number
          scope_key: string
          scope_type: string
          total_cost?: number
          total_revenue?: number
        }
        Update: {
          calculated_at?: string
          calculation_batch_id?: string | null
          created_at?: string
          flags?: Json | null
          id?: string
          margin_percent?: number | null
          period_end?: string
          period_start?: string
          profit?: number
          scope_key?: string
          scope_type?: string
          total_cost?: number
          total_revenue?: number
        }
        Relationships: []
      }
      pnl_trip: {
        Row: {
          branch: string | null
          calculated_at: string
          calculation_batch_id: string | null
          created_at: string
          delivery_trip_id: string
          fixed_cost_allocated: number
          flags: Json | null
          id: string
          idle_cost: number
          margin_percent: number | null
          period_end: string
          period_start: string
          profit: number
          revenue: number
          total_cost: number
          variable_cost: number
          vehicle_id: string
        }
        Insert: {
          branch?: string | null
          calculated_at?: string
          calculation_batch_id?: string | null
          created_at?: string
          delivery_trip_id: string
          fixed_cost_allocated?: number
          flags?: Json | null
          id?: string
          idle_cost?: number
          margin_percent?: number | null
          period_end: string
          period_start: string
          profit?: number
          revenue?: number
          total_cost?: number
          variable_cost?: number
          vehicle_id: string
        }
        Update: {
          branch?: string | null
          calculated_at?: string
          calculation_batch_id?: string | null
          created_at?: string
          delivery_trip_id?: string
          fixed_cost_allocated?: number
          flags?: Json | null
          id?: string
          idle_cost?: number
          margin_percent?: number | null
          period_end?: string
          period_start?: string
          profit?: number
          revenue?: number
          total_cost?: number
          variable_cost?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "pnl_trip_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      pnl_vehicle: {
        Row: {
          branch: string | null
          calculated_at: string
          calculation_batch_id: string | null
          created_at: string
          fixed_cost: number
          flags: Json | null
          id: string
          idle_cost: number
          margin_percent: number | null
          period_end: string
          period_start: string
          profit: number
          revenue: number
          total_cost: number
          variable_cost: number
          vehicle_id: string
        }
        Insert: {
          branch?: string | null
          calculated_at?: string
          calculation_batch_id?: string | null
          created_at?: string
          fixed_cost?: number
          flags?: Json | null
          id?: string
          idle_cost?: number
          margin_percent?: number | null
          period_end: string
          period_start: string
          profit?: number
          revenue?: number
          total_cost?: number
          variable_cost?: number
          vehicle_id: string
        }
        Update: {
          branch?: string | null
          calculated_at?: string
          calculation_batch_id?: string | null
          created_at?: string
          fixed_cost?: number
          flags?: Json | null
          id?: string
          idle_cost?: number
          margin_percent?: number | null
          period_end?: string
          period_start?: string
          profit?: number
          revenue?: number
          total_cost?: number
          variable_cost?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pnl_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      price_change_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          effective_date: string
          id: string
          new_price: number
          old_price: number | null
          product_id: string
          tier_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          effective_date: string
          id?: string
          new_price: number
          old_price?: number | null
          product_id: string
          tier_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          effective_date?: string
          id?: string
          new_price?: number
          old_price?: number | null
          product_id?: string
          tier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_change_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_change_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_history_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "customer_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_pallet_configs: {
        Row: {
          config_name: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_compact_mode: boolean | null
          is_default: boolean | null
          is_safe_mode: boolean | null
          layers: number
          layout_details: Json | null
          notes: string | null
          pallet_id: string
          product_id: string
          requires_special_handling: boolean | null
          requires_strapping: boolean | null
          total_height_cm: number | null
          total_units: number | null
          total_weight_kg: number | null
          units_per_layer: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_name: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_compact_mode?: boolean | null
          is_default?: boolean | null
          is_safe_mode?: boolean | null
          layers: number
          layout_details?: Json | null
          notes?: string | null
          pallet_id: string
          product_id: string
          requires_special_handling?: boolean | null
          requires_strapping?: boolean | null
          total_height_cm?: number | null
          total_units?: number | null
          total_weight_kg?: number | null
          units_per_layer: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_name?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_compact_mode?: boolean | null
          is_default?: boolean | null
          is_safe_mode?: boolean | null
          layers?: number
          layout_details?: Json | null
          notes?: string | null
          pallet_id?: string
          product_id?: string
          requires_special_handling?: boolean | null
          requires_strapping?: boolean | null
          total_height_cm?: number | null
          total_units?: number | null
          total_weight_kg?: number | null
          units_per_layer?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pallet_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pallet_configs_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pallet_configs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_pallet_configs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pallet_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tier_prices: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean | null
          min_quantity: number | null
          price: number
          product_id: string
          tier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity?: number | null
          price: number
          product_id: string
          tier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity?: number | null
          price?: number
          product_id?: string
          tier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_tier_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tier_prices_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "customer_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_price: number | null
          category: string
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          description: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_fragile: boolean | null
          is_liquid: boolean | null
          length_cm: number | null
          min_stock_level: number | null
          orientation_constraints: Json | null
          packaging_type: string | null
          pallet_id: string | null
          product_code: string
          product_name: string
          requires_temperature: string | null
          stacking_limit: number | null
          unit: string
          updated_at: string
          updated_by: string | null
          uses_pallet: boolean | null
          volume_liter: number | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          base_price?: number | null
          category: string
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_fragile?: boolean | null
          is_liquid?: boolean | null
          length_cm?: number | null
          min_stock_level?: number | null
          orientation_constraints?: Json | null
          packaging_type?: string | null
          pallet_id?: string | null
          product_code: string
          product_name: string
          requires_temperature?: string | null
          stacking_limit?: number | null
          unit: string
          updated_at?: string
          updated_by?: string | null
          uses_pallet?: boolean | null
          volume_liter?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          base_price?: number | null
          category?: string
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_fragile?: boolean | null
          is_liquid?: boolean | null
          length_cm?: number | null
          min_stock_level?: number | null
          orientation_constraints?: Json | null
          packaging_type?: string | null
          pallet_id?: string | null
          product_code?: string
          product_name?: string
          requires_temperature?: string | null
          stacking_limit?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          uses_pallet?: boolean | null
          volume_liter?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_feature_access: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          feature_key: string
          access_level: Database["public"]["Enums"]["feature_access_level"]
          updated_at: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          feature_key: string
          access_level: Database["public"]["Enums"]["feature_access_level"]
          updated_at?: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          feature_key?: string
          access_level?: Database["public"]["Enums"]["feature_access_level"]
          updated_at?: string
        }
        Relationships: []
      },
      role_order_branch_scope: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          profile_branch: string
          visibility: Database["public"]["Enums"]["order_branch_visibility"]
          updated_at: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          profile_branch: string
          visibility?: Database["public"]["Enums"]["order_branch_visibility"]
          updated_at?: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          profile_branch?: string
          visibility?: Database["public"]["Enums"]["order_branch_visibility"]
          updated_at?: string
        }
        Relationships: []
      },
      profiles: {
        Row: {
          avatar_url: string | null
          branch: string | null
          created_at: string
          deleted_at: string | null
          department: string | null
          email: string | null
          employee_code: string | null
          full_name: string | null
          id: string
          is_banned: boolean
          is_shared_account: boolean
          name_prefix: string | null
          phone: string | null
          position: string | null
          resignation_date: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          avatar_url?: string | null
          branch?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string | null
          id: string
          is_banned?: boolean
          is_shared_account?: boolean
          name_prefix?: string | null
          phone?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          avatar_url?: string | null
          branch?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean
          is_shared_account?: boolean
          name_prefix?: string | null
          phone?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      },
      service_staff: {
        Row: {
          branch: string | null
          created_at: string
          created_by: string | null
          default_team: string | null
          employee_code: string | null
          id: string
          name: string
          name_prefix: string | null
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          created_by?: string | null
          default_team?: string | null
          employee_code?: string | null
          id?: string
          name: string
          name_prefix?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          created_by?: string | null
          default_team?: string | null
          employee_code?: string | null
          id?: string
          name?: string
          name_prefix?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_staff_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salaries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          monthly_salary: number
          notes: string | null
          staff_id: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          monthly_salary: number
          notes?: string | null
          staff_id: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          monthly_salary?: number
          notes?: string | null
          staff_id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salaries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "staff_salaries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          branch: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          customer_code: string
          customer_name: string
          email: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          notes: string | null
          payment_terms: number | null
          phone: string | null
          tier_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          branch?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_code: string
          customer_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          tier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          branch?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_code?: string
          customer_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          tier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "customer_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_approvals: {
        Row: {
          action: string
          approved_by: string | null
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          level: number
          role_at_approval: string | null
          signature_url: string | null
          ticket_id: number
          user_agent: string | null
        }
        Insert: {
          action: string
          approved_by?: string | null
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          level: number
          role_at_approval?: string | null
          signature_url?: string | null
          ticket_id: number
          user_agent?: string | null
        }
        Update: {
          action?: string
          approved_by?: string | null
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          level?: number
          role_at_approval?: string | null
          signature_url?: string | null
          ticket_id?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_approvals_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_approvals_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_relations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_costs: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          note: string | null
          ticket_id: number
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          note?: string | null
          ticket_id: number
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          note?: string | null
          ticket_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_costs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_costs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_relations"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          approval_history: Json | null
          created_at: string
          executive_name: string | null
          executive_signature_url: string | null
          executive_signed_at: string | null
          garage: string | null
          id: number
          image_urls: Json | null
          inspector_name: string | null
          inspector_signature_url: string | null
          inspector_signed_at: string | null
          manager_name: string | null
          manager_signature_url: string | null
          manager_signed_at: string | null
          odometer: number | null
          problem_description: string | null
          repair_assigned_to: string | null
          repair_expected_completion: string | null
          repair_notes: string | null
          repair_start_date: string | null
          repair_type: string | null
          reporter_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string | null
          urgency: Database["public"]["Enums"]["urgency_level"]
          vehicle_id: string
        }
        Insert: {
          approval_history?: Json | null
          created_at?: string
          executive_name?: string | null
          executive_signature_url?: string | null
          executive_signed_at?: string | null
          garage?: string | null
          id?: number
          image_urls?: Json | null
          inspector_name?: string | null
          inspector_signature_url?: string | null
          inspector_signed_at?: string | null
          manager_name?: string | null
          manager_signature_url?: string | null
          manager_signed_at?: string | null
          odometer?: number | null
          problem_description?: string | null
          repair_assigned_to?: string | null
          repair_expected_completion?: string | null
          repair_notes?: string | null
          repair_start_date?: string | null
          repair_type?: string | null
          reporter_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"]
          vehicle_id: string
        }
        Update: {
          approval_history?: Json | null
          created_at?: string
          executive_name?: string | null
          executive_signature_url?: string | null
          executive_signed_at?: string | null
          garage?: string | null
          id?: number
          image_urls?: Json | null
          inspector_name?: string | null
          inspector_signature_url?: string | null
          inspector_signed_at?: string | null
          manager_name?: string | null
          manager_signature_url?: string | null
          manager_signed_at?: string | null
          odometer?: number | null
          problem_description?: string | null
          repair_assigned_to?: string | null
          repair_expected_completion?: string | null
          repair_notes?: string | null
          repair_start_date?: string | null
          repair_type?: string | null
          reporter_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_repair_assigned_to_fkey"
            columns: ["repair_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_edit_history: {
        Row: {
          changes: Json
          delivery_trip_id: string | null
          edit_reason: string
          edited_at: string | null
          edited_by: string | null
          id: string
          trip_log_id: string | null
        }
        Insert: {
          changes: Json
          delivery_trip_id?: string | null
          edit_reason: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          trip_log_id?: string | null
        }
        Update: {
          changes?: Json
          delivery_trip_id?: string | null
          edit_reason?: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          trip_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_edit_history_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_edit_history_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_edit_history_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_edit_history_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_edit_history_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_edit_history_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_edit_history_trip_log_id_fkey"
            columns: ["trip_log_id"]
            isOneToOne: false
            referencedRelation: "trip_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_logs: {
        Row: {
          checkin_time: string | null
          checkout_time: string
          created_at: string | null
          delivery_trip_id: string | null
          destination: string | null
          distance_km: number | null
          driver_id: string
          duration_hours: number | null
          edit_reason: string | null
          id: string
          manual_distance_km: number | null
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          route: string | null
          status: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          checkin_time?: string | null
          checkout_time?: string
          created_at?: string | null
          delivery_trip_id?: string | null
          destination?: string | null
          distance_km?: number | null
          driver_id: string
          duration_hours?: number | null
          edit_reason?: string | null
          id?: string
          manual_distance_km?: number | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          route?: string | null
          status?: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          checkin_time?: string | null
          checkout_time?: string
          created_at?: string | null
          delivery_trip_id?: string | null
          destination?: string | null
          distance_km?: number | null
          driver_id?: string
          duration_hours?: number | null
          edit_reason?: string | null
          id?: string
          manual_distance_km?: number | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          route?: string | null
          status?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: true
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: true
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: true
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: true
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_logs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: true
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_packing_layout: {
        Row: {
          created_at: string
          delivery_trip_id: string
          id: string
          layer_index: number
          notes: string | null
          position_index: number
          position_type: string
          total_layers: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_trip_id: string
          id?: string
          layer_index?: number
          notes?: string | null
          position_index?: number
          position_type?: string
          total_layers?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_trip_id?: string
          id?: string
          layer_index?: number
          notes?: string | null
          position_index?: number
          position_type?: string
          total_layers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_packing_layout_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_layout_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_layout_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_packing_layout_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_packing_layout_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
        ]
      }
      trip_packing_layout_items: {
        Row: {
          created_at: string
          delivery_trip_item_id: string
          id: string
          layer_index: number | null
          quantity: number
          sequence_in_layer: number | null
          trip_packing_layout_id: string
        }
        Insert: {
          created_at?: string
          delivery_trip_item_id: string
          id?: string
          layer_index?: number | null
          quantity?: number
          sequence_in_layer?: number | null
          trip_packing_layout_id: string
        }
        Update: {
          created_at?: string
          delivery_trip_item_id?: string
          id?: string
          layer_index?: number | null
          quantity?: number
          sequence_in_layer?: number | null
          trip_packing_layout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_packing_layout_items_delivery_trip_item_id_fkey"
            columns: ["delivery_trip_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_trip_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_layout_items_delivery_trip_item_id_fkey"
            columns: ["delivery_trip_item_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "trip_packing_layout_items_trip_packing_layout_id_fkey"
            columns: ["trip_packing_layout_id"]
            isOneToOne: false
            referencedRelation: "trip_packing_layout"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_packing_snapshots: {
        Row: {
          captured_at: string | null
          captured_by: string | null
          delivery_trip_id: string
          id: string
          notes: string | null
          packing_layout: Json
          pallets_used: number
          utilization_percent: number
          vehicle_id: string
          volume_used_liter: number
          weight_kg: number
        }
        Insert: {
          captured_at?: string | null
          captured_by?: string | null
          delivery_trip_id: string
          id?: string
          notes?: string | null
          packing_layout: Json
          pallets_used: number
          utilization_percent: number
          vehicle_id: string
          volume_used_liter: number
          weight_kg: number
        }
        Update: {
          captured_at?: string | null
          captured_by?: string | null
          delivery_trip_id?: string
          id?: string
          notes?: string | null
          packing_layout?: Json
          pallets_used?: number
          utilization_percent?: number
          vehicle_id?: string
          volume_used_liter?: number
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_packing_snapshots_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_snapshots_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_post_analysis: {
        Row: {
          ai_summary: string
          analysis_type: string
          created_at: string | null
          created_by: string | null
          delivery_trip_id: string
          id: string
        }
        Insert: {
          ai_summary: string
          analysis_type: string
          created_at?: string | null
          created_by?: string | null
          delivery_trip_id: string
          id?: string
        }
        Update: {
          ai_summary?: string
          analysis_type?: string
          created_at?: string | null
          created_by?: string | null
          delivery_trip_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_post_analysis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_post_analysis_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_post_analysis_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_post_analysis_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_post_analysis_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "trip_post_analysis_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
        ]
      }
      vehicle_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_read: boolean | null
          is_resolved: boolean | null
          message: string
          reference_id: string | null
          reference_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          vehicle_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message: string
          reference_id?: string | null
          reference_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
          vehicle_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string
          expiry_date: string | null
          file_name: string
          file_url: string
          id: string
          issued_date: string | null
          mime_type: string | null
          notes: string | null
          remind_before_days: number | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type: string
          expiry_date?: string | null
          file_name: string
          file_url: string
          id?: string
          issued_date?: string | null
          mime_type?: string | null
          notes?: string | null
          remind_before_days?: number | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_url?: string
          id?: string
          issued_date?: string | null
          mime_type?: string | null
          notes?: string | null
          remind_before_days?: number | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_fixed_costs: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          cost_type: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period_end: string | null
          period_start: string
          period_type: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          cost_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start: string
          period_type: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          cost_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string
          period_type?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fixed_costs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_insurance_records: {
        Row: {
          contact_phone: string | null
          coverage_amount: number | null
          coverage_type: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          id: string
          notes: string | null
          policy_number: string | null
          premium_amount: number | null
          provider_name: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          contact_phone?: string | null
          coverage_amount?: number | null
          coverage_type?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          policy_number?: string | null
          premium_amount?: number | null
          provider_name?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          contact_phone?: string | null
          coverage_amount?: number | null
          coverage_type?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          policy_number?: string | null
          premium_amount?: number | null
          provider_name?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_insurance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_insurance_records_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vehicle_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_insurance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_insurance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_insurance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_loading_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          layout_config: Json
          template_name: string
          total_items_packed: number | null
          updated_at: string | null
          updated_by: string | null
          utilization_percentage: number | null
          vehicle_id: string
          weight_utilization_percentage: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          layout_config: Json
          template_name: string
          total_items_packed?: number | null
          updated_at?: string | null
          updated_by?: string | null
          utilization_percentage?: number | null
          vehicle_id: string
          weight_utilization_percentage?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          layout_config?: Json
          template_name?: string
          total_items_packed?: number | null
          updated_at?: string | null
          updated_by?: string | null
          utilization_percentage?: number | null
          vehicle_id?: string
          weight_utilization_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_loading_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_loading_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_loading_templates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_loading_templates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_loading_templates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_tax_records: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          document_id: string | null
          id: string
          notes: string | null
          paid_date: string | null
          receipt_number: string | null
          tax_number: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          receipt_number?: string | null
          tax_number?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          receipt_number?: string | null
          tax_number?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_tax_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tax_records_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vehicle_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tax_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tax_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tax_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_usage: {
        Row: {
          created_at: string | null
          destination: string | null
          distance_km: number | null
          duration_hours: number | null
          end_time: string | null
          id: string
          is_manual_correction: boolean
          notes: string | null
          odometer_end: number | null
          odometer_start: number
          purpose: string
          route: string | null
          start_time: string
          status: string | null
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          destination?: string | null
          distance_km?: number | null
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          is_manual_correction?: boolean
          notes?: string | null
          odometer_end?: number | null
          odometer_start: number
          purpose: string
          route?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          destination?: string | null
          distance_km?: number | null
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          is_manual_correction?: boolean
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number
          purpose?: string
          route?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_usage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_usage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_usage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_variable_costs: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          cost_date: string
          cost_type: string
          created_at: string
          created_by: string | null
          delivery_trip_id: string | null
          id: string
          notes: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          vehicle_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          cost_date: string
          cost_type: string
          created_at?: string
          created_by?: string | null
          delivery_trip_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          cost_date?: string
          cost_type?: string
          created_at?: string
          created_by?: string | null
          delivery_trip_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_variable_costs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          branch: string | null
          cargo_height_cm: number | null
          cargo_length_cm: number | null
          cargo_shape_type: string | null
          cargo_volume_liter: number | null
          cargo_width_cm: number | null
          created_at: string
          has_shelves: boolean | null
          id: string
          image_url: string | null
          lat: number | null
          lng: number | null
          loading_constraints: Json | null
          make: string | null
          max_weight_kg: number | null
          model: string | null
          owner_group: string | null
          plate: string
          shelf_config: Json | null
          type: string | null
        }
        Insert: {
          branch?: string | null
          cargo_height_cm?: number | null
          cargo_length_cm?: number | null
          cargo_shape_type?: string | null
          cargo_volume_liter?: number | null
          cargo_width_cm?: number | null
          created_at?: string
          has_shelves?: boolean | null
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          loading_constraints?: Json | null
          make?: string | null
          max_weight_kg?: number | null
          model?: string | null
          owner_group?: string | null
          plate: string
          shelf_config?: Json | null
          type?: string | null
        }
        Update: {
          branch?: string | null
          cargo_height_cm?: number | null
          cargo_length_cm?: number | null
          cargo_shape_type?: string | null
          cargo_volume_liter?: number | null
          cargo_width_cm?: number | null
          created_at?: string
          has_shelves?: boolean | null
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          loading_constraints?: Json | null
          make?: string | null
          max_weight_kg?: number | null
          model?: string | null
          owner_group?: string | null
          plate?: string
          shelf_config?: Json | null
          type?: string | null
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          branch: string | null
          capacity_m3: number | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          manager_id: string | null
          name: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch?: string | null
          capacity_m3?: number | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_id?: string | null
          name: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch?: string | null
          capacity_m3?: number | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_id?: string | null
          name?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      delivery_trip_active_crews: {
        Row: {
          created_at: string | null
          delivery_trip_id: string | null
          employee_code: string | null
          role: string | null
          staff_id: string | null
          staff_name: string | null
          start_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      delivery_trip_crew_history: {
        Row: {
          created_at: string | null
          delivery_trip_id: string | null
          end_at: string | null
          reason_for_change: string | null
          replaced_by_name: string | null
          role: string | null
          staff_id: string | null
          staff_name: string | null
          start_at: string | null
          status: string | null
          trip_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      delivery_trips_ready_for_pnl: {
        Row: {
          created_at: string | null
          driver_id: string | null
          id: string | null
          planned_date: string | null
          status: string | null
          trip_end_date: string | null
          trip_number: string | null
          trip_revenue: number | null
          trip_start_date: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          id?: string | null
          planned_date?: string | null
          status?: string | null
          trip_end_date?: string | null
          trip_number?: string | null
          trip_revenue?: number | null
          trip_start_date?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          id?: string | null
          planned_date?: string | null
          status?: string | null
          trip_end_date?: string | null
          trip_number?: string | null
          trip_revenue?: number | null
          trip_start_date?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_efficiency_summary: {
        Row: {
          avg_efficiency: number | null
          fill_count: number | null
          make: string | null
          max_efficiency: number | null
          min_efficiency: number | null
          model: string | null
          month: string | null
          plate: string | null
          total_cost: number | null
          total_liters: number | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_with_details: {
        Row: {
          available_quantity: number | null
          base_price: number | null
          category: string | null
          created_at: string | null
          id: string | null
          last_updated_at: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          reserved_quantity: number | null
          stock_status: string | null
          unit: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
          warehouse_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items_with_fulfillment: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          fulfillment_status: string | null
          id: string | null
          is_bonus: boolean | null
          line_total: number | null
          notes: string | null
          order_id: string | null
          product_id: string | null
          quantity: number | null
          quantity_delivered: number | null
          quantity_picked_up_at_store: number | null
          quantity_remaining: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          fulfillment_status?: never
          id?: string | null
          is_bonus?: boolean | null
          line_total?: number | null
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          quantity_delivered?: number | null
          quantity_picked_up_at_store?: number | null
          quantity_remaining?: never
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          fulfillment_status?: never
          id?: string | null
          is_bonus?: boolean | null
          line_total?: number | null
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          quantity_delivered?: number | null
          quantity_picked_up_at_store?: number | null
          quantity_remaining?: never
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_remaining_quantities: {
        Row: {
          order_item_id: string
          order_id: string
          product_id: string
          total_quantity: number
          quantity_picked_up_at_store: number
          quantity_delivered: number
          fulfillment_method: string
          allocated_quantity: number
          fulfilled_via_allocations: number
          remaining_unallocated: number
          has_allocations: boolean
        }
        Relationships: []
      }
      order_remaining_summary: {
        Row: {
          order_id: string
          store_id: string | null
          branch: string | null
          order_status: string | null
          trip_count: number
          total_remaining: number
          total_allocated: number
          total_delivery_qty: number
          has_any_allocation: boolean
        }
        Relationships: []
      }
      orders_with_details: {
        Row: {
          branch: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          customer_code: string | null
          customer_name: string | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_trip_id: string | null
          discount_amount: number | null
          exclude_from_vehicle_revenue_rollup: boolean | null
          id: string | null
          internal_notes: string | null
          items_count: number | null
          notes: string | null
          order_date: string | null
          order_number: string | null
          related_prior_order_id: string | null
          related_prior_order_number: string | null
          replaces_sml_doc_no: string | null
          status: string | null
          store_address: string | null
          store_id: string | null
          store_phone: string | null
          subtotal: number | null
          tax_amount: number | null
          tier_code: string | null
          tier_color: string | null
          tier_name: string | null
          total_amount: number | null
          total_quantity: number | null
          trip_date: string | null
          trip_number: string | null
          trip_status: string | null
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_efficiency_trend: {
        Row: {
          avg_efficiency_score: number | null
          avg_utilization: number | null
          issue_rate_percent: number | null
          issue_trend: string | null
          layout_adoption_rate: number | null
          month_label: string | null
          total_trips: number | null
          trips_with_issues: number | null
          trips_with_layout: number | null
          utilization_gap: number | null
          utilization_trend: string | null
        }
        Relationships: []
      }
      packing_insights_summary: {
        Row: {
          metric_category: string | null
          metric_name: string | null
          metric_value: string | null
          trend: string | null
        }
        Relationships: []
      }
      packing_product_affinity: {
        Row: {
          affinity_percentage: number | null
          cooccurrence_count: number | null
          product_a_category: string | null
          product_b_category: string | null
          product_pair: string | null
          trip_count: number | null
        }
        Relationships: []
      }
      pallet_usage_by_weight_range: {
        Row: {
          avg_pallets: number | null
          avg_utilization: number | null
          efficiency_level: string | null
          max_pallets: number | null
          min_pallets: number | null
          stddev_pallets: number | null
          trip_count: number | null
          weight_range: string | null
        }
        Relationships: []
      }
      pallet_weight_distribution: {
        Row: {
          avg_heavy_item_types: number | null
          avg_heavy_weight_kg: number | null
          avg_light_item_types: number | null
          avg_light_weight_kg: number | null
          avg_weight_kg: number | null
          max_weight_kg: number | null
          min_weight_kg: number | null
          pallet_count: number | null
          pallet_position: string | null
          position_index: number | null
          stddev_weight_kg: number | null
          weight_pattern: string | null
        }
        Relationships: []
      }
      pending_orders: {
        Row: {
          branch: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          customer_code: string | null
          customer_name: string | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_trip_id: string | null
          discount_amount: number | null
          id: string | null
          internal_notes: string | null
          items_count: number | null
          notes: string | null
          order_date: string | null
          order_number: string | null
          status: string | null
          store_address: string | null
          store_id: string | null
          store_phone: string | null
          subtotal: number | null
          tax_amount: number | null
          tier_code: string | null
          tier_color: string | null
          tier_name: string | null
          total_amount: number | null
          total_quantity: number | null
          trip_date: string | null
          trip_number: string | null
          trip_status: string | null
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      pnl_data_issues: {
        Row: {
          branch: string | null
          delivery_trip_id: string | null
          flags: Json | null
          issue_code: string | null
          level: string | null
          message: string | null
          period_end: string | null
          period_start: string | null
          severity: string | null
          source_id: string | null
          vehicle_id: string | null
        }
        Relationships: []
      }
      pnl_fleet_anomalies: {
        Row: {
          flags: Json | null
          issue_code: string | null
          margin_percent: number | null
          message: string | null
          period_end: string | null
          period_start: string | null
          pnl_fleet_id: string | null
          profit: number | null
          scope_key: string | null
          scope_type: string | null
          severity: string | null
          total_cost: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      pnl_trip_anomalies: {
        Row: {
          branch: string | null
          delivery_trip_id: string | null
          fixed_cost_allocated: number | null
          flags: Json | null
          idle_cost: number | null
          issue_code: string | null
          margin_percent: number | null
          message: string | null
          period_end: string | null
          period_start: string | null
          pnl_trip_id: string | null
          profit: number | null
          revenue: number | null
          severity: string | null
          total_cost: number | null
          variable_cost: number | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "pnl_trip_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "pnl_trip_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_trip_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      pnl_vehicle_anomalies: {
        Row: {
          branch: string | null
          fixed_cost: number | null
          flags: Json | null
          idle_cost: number | null
          issue_code: string | null
          margin_percent: number | null
          message: string | null
          period_end: string | null
          period_start: string | null
          pnl_vehicle_id: string | null
          profit: number | null
          revenue: number | null
          severity: string | null
          total_cost: number | null
          variable_cost: number | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pnl_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      product_distribution_by_trip: {
        Row: {
          category: string | null
          delivery_trip_id: string | null
          planned_date: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          quantity_per_staff: number | null
          store_count: number | null
          total_quantity: number | null
          total_staff_count: number | null
          trip_number: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "delivery_trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices_summary: {
        Row: {
          base_price: number | null
          category: string | null
          cost_per_unit: number | null
          effective_from: string | null
          effective_to: string | null
          margin_percent: number | null
          min_quantity: number | null
          price_active: boolean | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          tier_code: string | null
          tier_name: string | null
          tier_price: number | null
          unit: string | null
        }
        Relationships: []
      }
      staff_item_distribution: {
        Row: {
          category: string | null
          crew_id: string | null
          crew_status: string | null
          delivery_trip_id: string | null
          delivery_trip_store_id: string | null
          item_id: string | null
          item_notes: string | null
          planned_date: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          quantity_per_staff: number | null
          staff_code: string | null
          staff_id: string | null
          staff_name: string | null
          staff_phone: string | null
          staff_role: string | null
          staff_start_at: string | null
          store_code: string | null
          store_id: string | null
          store_name: string | null
          total_quantity: number | null
          total_staff_count: number | null
          trip_number: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "delivery_trip_items_delivery_trip_store_id_fkey"
            columns: ["delivery_trip_store_id"]
            isOneToOne: false
            referencedRelation: "delivery_trip_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "delivery_trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_item_distribution_summary: {
        Row: {
          avg_items_per_staff_in_trip: number | null
          crew_id: string | null
          crew_status: string | null
          delivery_trip_id: string | null
          distinct_product_count: number | null
          distinct_store_count: number | null
          planned_date: string | null
          staff_code: string | null
          staff_id: string | null
          staff_name: string | null
          staff_phone: string | null
          staff_role: string | null
          staff_start_at: string | null
          total_items_per_staff: number | null
          total_items_to_carry: number | null
          total_staff_count: number | null
          trip_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_trip_crews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      staff_item_statistics: {
        Row: {
          completed_trips: number | null
          first_trip_date: string | null
          in_progress_trips: number | null
          last_trip_date: string | null
          planned_trips: number | null
          staff_code: string | null
          staff_id: string | null
          staff_name: string | null
          staff_phone: string | null
          staff_status: string | null
          total_items_carried: number | null
          total_trips: number | null
        }
        Relationships: []
      }
      staff_salaries_ready_for_pnl: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string | null
          monthly_salary: number | null
          notes: string | null
          staff_id: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string | null
          monthly_salary?: number | null
          notes?: string | null
          staff_id?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string | null
          monthly_salary?: number | null
          notes?: string | null
          staff_id?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_salaries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_item_statistics"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "staff_salaries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_with_relations: {
        Row: {
          approval_history: Json | null
          branch: string | null
          created_at: string | null
          executive_name: string | null
          executive_signature_url: string | null
          executive_signed_at: string | null
          garage: string | null
          id: number | null
          image_urls: Json | null
          inspector_name: string | null
          inspector_signature_url: string | null
          inspector_signed_at: string | null
          make: string | null
          manager_name: string | null
          manager_signature_url: string | null
          manager_signed_at: string | null
          model: string | null
          odometer: number | null
          problem_description: string | null
          repair_assigned_to: string | null
          repair_expected_completion: string | null
          repair_notes: string | null
          repair_start_date: string | null
          repair_type: string | null
          reporter_avatar_url: string | null
          reporter_email: string | null
          reporter_id: string | null
          reporter_name: string | null
          reporter_role: Database["public"]["Enums"]["app_role"] | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          ticket_number: string | null
          urgency: Database["public"]["Enums"]["urgency_level"] | null
          vehicle_id: string | null
          vehicle_image_url: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_repair_assigned_to_fkey"
            columns: ["repair_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      top_product_pairs: {
        Row: {
          affinity_percentage: number | null
          category_combination: string | null
          cooccurrence_count: number | null
          product_pair: string | null
          rank_by_affinity: number | null
          rank_by_frequency: number | null
        }
        Relationships: []
      }
      vehicle_dashboard: {
        Row: {
          active_schedules: number | null
          avg_fuel_efficiency: number | null
          branch: string | null
          critical_alerts_count: number | null
          current_odometer: number | null
          fuel_cost_last_30_days: number | null
          id: string | null
          last_fuel_date: string | null
          last_maintenance_date: string | null
          maintenance_cost_last_30_days: number | null
          make: string | null
          model: string | null
          plate: string | null
          trips_last_30_days: number | null
          type: string | null
          unresolved_alerts_count: number | null
          upcoming_maintenance_count: number | null
          usage_status: string | null
        }
        Insert: {
          active_schedules?: never
          avg_fuel_efficiency?: never
          branch?: string | null
          critical_alerts_count?: never
          current_odometer?: never
          fuel_cost_last_30_days?: never
          id?: string | null
          last_fuel_date?: never
          last_maintenance_date?: never
          maintenance_cost_last_30_days?: never
          make?: string | null
          model?: string | null
          plate?: string | null
          trips_last_30_days?: never
          type?: string | null
          unresolved_alerts_count?: never
          upcoming_maintenance_count?: never
          usage_status?: never
        }
        Update: {
          active_schedules?: never
          avg_fuel_efficiency?: never
          branch?: string | null
          critical_alerts_count?: never
          current_odometer?: never
          fuel_cost_last_30_days?: never
          id?: string | null
          last_fuel_date?: never
          last_maintenance_date?: never
          maintenance_cost_last_30_days?: never
          make?: string | null
          model?: string | null
          plate?: string | null
          trips_last_30_days?: never
          type?: string | null
          unresolved_alerts_count?: never
          upcoming_maintenance_count?: never
          usage_status?: never
        }
        Relationships: []
      }
      vehicle_fixed_costs_ready_for_pnl: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          cost_type: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          period_type: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cost_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cost_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fixed_costs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fixed_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_usage_daily: {
        Row: {
          active_vehicles: number | null
          avg_distance: number | null
          day: string | null
          total_distance: number | null
          total_hours: number | null
          total_trips: number | null
        }
        Relationships: []
      }
      vehicle_usage_summary: {
        Row: {
          avg_distance: number | null
          avg_hours: number | null
          make: string | null
          model: string | null
          month: string | null
          plate: string | null
          total_distance: number | null
          total_hours: number | null
          trip_count: number | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_usage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_usage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_usage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_variable_costs_ready_for_pnl: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          cost_date: string | null
          cost_type: string | null
          created_at: string | null
          created_by: string | null
          delivery_trip_id: string | null
          id: string | null
          notes: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cost_date?: string | null
          cost_type?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_trip_id?: string | null
          id?: string | null
          notes?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cost_date?: string | null
          cost_type?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_trip_id?: string | null
          id?: string | null
          notes?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_variable_costs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "delivery_trips_ready_for_pnl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "product_distribution_by_trip"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_delivery_trip_id_fkey"
            columns: ["delivery_trip_id"]
            isOneToOne: false
            referencedRelation: "staff_item_distribution_summary"
            referencedColumns: ["delivery_trip_id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_variable_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles_with_status: {
        Row: {
          branch: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          last_fuel_efficiency: number | null
          lat: number | null
          lng: number | null
          make: string | null
          model: string | null
          plate: string | null
          status: string | null
          trips_last_30_days: number | null
          type: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          last_fuel_efficiency?: never
          lat?: number | null
          lng?: number | null
          make?: string | null
          model?: string | null
          plate?: string | null
          status?: never
          trips_last_30_days?: never
          type?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          last_fuel_efficiency?: never
          lat?: number | null
          lng?: number | null
          make?: string | null
          model?: string | null
          plate?: string | null
          status?: never
          trips_last_30_days?: never
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _generate_order_number_text: { Args: never; Returns: string }
      assign_orders_to_trip: {
        Args: { p_order_ids: string[]; p_trip_id: string; p_updated_by: string }
        Returns: {
          order_id: string
          order_number: string
          updated_count: number
        }[]
      }
      backfill_quantity_delivered_for_trip: {
        Args: { p_trip_id: string }
        Returns: {
          item_id: string
          new_delivered: number
          old_delivered: number
          order_id: string
          order_number: string
          ordered_qty: number
          product_code: string
          product_name: string
          updated: boolean
        }[]
      }
      recalculate_quantity_delivered_after_order_unassign: {
        Args: { p_excluded_trip_id?: string | null; p_order_ids: string[] }
        Returns: undefined
      }
      recalculate_orders_status_from_fulfillment_quantities: {
        Args: { p_order_ids: string[] }
        Returns: undefined
      }
      calculate_layout_similarity: {
        Args: { p_trip_a_id: string; p_trip_b_id: string }
        Returns: number
      }
      calculate_order_total: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      post_purchase_receipt: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      check_maintenance_alerts: { Args: never; Returns: undefined }
      check_vehicle_document_expiry: { Args: never; Returns: undefined }
      current_user_id: { Args: never; Returns: string }
      delete_order_items: {
        Args: {
          p_item_ids?: string[]
          p_order_id?: string
          p_order_number?: string
        }
        Returns: {
          deleted_count: number
          message: string
          order_number: string
        }[]
      }
      delete_orders: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_order_id?: string
          p_order_number?: string
          p_order_numbers?: string[]
          p_status?: string
        }
        Returns: {
          deleted_count: number
          message: string
        }[]
      }
      generate_backfill_order_number: {
        Args: {
          p_order_date?: string
          p_order_id: string
          p_warehouse_id?: string
        }
        Returns: string
      }
      generate_order_number_for_pickup: {
        Args: { p_order_id: string }
        Returns: string
      }
      generate_order_number_for_trip: {
        Args: { p_order_id: string; p_trip_id: string }
        Returns: string
      }
      generate_order_number_with_branch: { Args: never; Returns: string }
      generate_order_numbers_for_trip: {
        Args: { p_trip_id: string }
        Returns: {
          order_id: string
          order_number: string
        }[]
      }
      generate_ticket_number: { Args: never; Returns: string }
      get_next_employee_code: { Args: never; Returns: string }
      get_order_item_remaining: {
        Args: {
          p_delivered: number
          p_picked_up_at_store: number
          p_quantity: number
        }
        Returns: number
      }
      get_product_packing_profiles: {
        Args: { p_product_ids: string[]; p_vehicle_id: string }
        Returns: {
          avg_qty_per_pallet: number
          layer_distribution: Json
          max_qty_per_pallet: number
          most_common_layer: string
          most_common_position: number
          position_distribution: Json
          product_id: string
          product_name: string
          times_packed: number
          top_copacked: string[]
        }[]
      }
      get_product_price_for_store: {
        Args: {
          p_date?: string
          p_product_id: string
          p_quantity?: number
          p_store_id: string
        }
        Returns: number
      }
      get_similar_trips: {
        Args: {
          p_current_volume_liter: number
          p_current_weight_kg: number
          p_limit?: number
          p_product_ids?: string[]
          p_store_ids?: string[]
          p_vehicle_id?: string
        }
        Returns: {
          actual_pallets_used: number
          actual_weight_kg: number
          delivery_trip_id: string
          had_packing_issues: boolean
          main_categories: string[]
          planned_date: string
          similarity_score: number
          space_utilization_percent: number
          store_ids: string[]
          trip_number: string
          vehicle_id: string
          vehicle_plate: string
        }[]
      }
      get_similar_trips_enhanced: {
        Args: {
          p_current_volume_liter: number
          p_current_weight_kg: number
          p_limit?: number
          p_product_ids?: string[]
          p_store_ids?: string[]
        }
        Returns: {
          actual_pallets_used: number
          actual_weight_kg: number
          delivery_trip_id: string
          had_packing_issues: boolean
          layout_similarity_score: number
          main_categories: string[]
          planned_date: string
          similarity_score: number
          space_utilization_percent: number
          store_ids: string[]
          trip_number: string
          vehicle_id: string
          vehicle_plate: string
        }[]
      }
      get_staff_item_details: {
        Args: {
          end_date?: string
          staff_id_param?: string
          start_date?: string
        }
        Returns: {
          category: string
          delivery_trip_id: string
          planned_date: string
          product_code: string
          product_id: string
          product_name: string
          quantity_per_staff: number
          staff_code: string
          staff_id: string
          staff_name: string
          staff_phone: string
          staff_status: string
          store_code: string
          store_name: string
          total_quantity: number
          trip_number: string
          unit: string
        }[]
      }
      get_staff_item_statistics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          completed_trips: number
          first_trip_date: string
          in_progress_trips: number
          last_trip_date: string
          planned_trips: number
          staff_code: string
          staff_id: string
          staff_name: string
          staff_phone: string
          staff_status: string
          total_items_carried: number
          total_trips: number
        }[]
      }
      get_trip_packing_layout_summary: {
        Args: { p_trip_id: string }
        Returns: string
      }
      get_vehicle_status: { Args: { p_vehicle_id: string }; Returns: string }
      get_vehicle_summary: {
        Args: never
        Returns: {
          active: number
          idle: number
          maintenance: number
          total: number
        }[]
      }
      has_role: {
        Args: { required_roles: string[]; user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_manager_or_admin: { Args: { user_id: string }; Returns: boolean }
      refresh_delivery_stats_by_day_product: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: undefined
      }
      refresh_delivery_stats_by_day_store: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: undefined
      }
      refresh_delivery_stats_by_day_store_product: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: undefined
      }
      refresh_delivery_stats_by_day_vehicle: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: undefined
      }
      run_daily_summary_refresh: { Args: never; Returns: undefined }
      update_order_item_pickup: {
        Args: {
          p_order_item_id: string
          p_quantity_picked_up: number
          p_updated_by?: string
        }
        Returns: {
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          fulfillment_method: string
          id: string
          is_bonus: boolean
          line_total: number
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          quantity_delivered: number
          quantity_picked_up_at_store: number
          unit_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      feature_access_level: "none" | "view" | "edit" | "manage";
      app_role:
        | "user"
        | "inspector"
        | "manager"
        | "executive"
        | "admin"
        | "driver"
        | "sales"
        | "service_staff"
        | "hr"
        | "accounting"
        | "warehouse"
        | "dev"
      ticket_status:
        | "pending"
        | "approved_inspector"
        | "approved_manager"
        | "ready_for_repair"
        | "in_progress"
        | "completed"
        | "rejected"
      urgency_level: "low" | "medium" | "high" | "critical"
      order_branch_visibility: "all_branches" | "own_branch_only"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type AppRole = Database['public']['Enums']['app_role'];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      feature_access_level: ["none", "view", "edit", "manage"],
      app_role: [
        "user",
        "inspector",
        "manager",
        "executive",
        "admin",
        "driver",
        "sales",
        "service_staff",
        "hr",
        "accounting",
        "warehouse",
        "dev",
      ],
      ticket_status: [
        "pending",
        "approved_inspector",
        "approved_manager",
        "ready_for_repair",
        "in_progress",
        "completed",
        "rejected",
      ],
      urgency_level: ["low", "medium", "high", "critical"],
      order_branch_visibility: ["all_branches", "own_branch_only"],
    },
  },
} as const
