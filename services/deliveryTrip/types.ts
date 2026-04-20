// Shared types for delivery trip services
import type { Database } from '../../types/database';

type DeliveryTrip = Database['public']['Tables']['delivery_trips']['Row'];
type DeliveryTripInsert = Database['public']['Tables']['delivery_trips']['Insert'];
type DeliveryTripUpdate = Database['public']['Tables']['delivery_trips']['Update'];

export interface DeliveryTripStore {
  id: string;
  delivery_trip_id: string;
  store_id: string;
  sequence_order: number;
  delivery_status?: string;
  /** สถานะออกบิล (pending / issued) — คอลัมน์ใน delivery_trip_stores */
  invoice_status?: string | null;
  delivered_at?: string;
  created_at?: string;
  updated_at?: string;
}

export type DeliveryTripItem = Database['public']['Tables']['delivery_trip_items']['Row'];
export type DeliveryTripItemChange = Database['public']['Tables']['delivery_trip_item_changes']['Row'];
export type DeliveryTripCrew = Database['public']['Tables']['delivery_trip_crews']['Row'];
export type DeliveryTripCrewInsert = Database['public']['Tables']['delivery_trip_crews']['Insert'];

export interface DeliveryTripStoreWithDetails extends DeliveryTripStore {
  store?: {
    id: string;
    customer_code: string;
    customer_name: string;
    address?: string;
    phone?: string;
  };
  items?: DeliveryTripItemWithProduct[];
  /** สถานะออเดอร์ที่ผูกกับทริปนี้ (partial/assigned = ส่งบางส่วน มีของค้างส่ง) — ใช้ในหน้าออกบิลฝ่ายขาย */
  order_status?: string;
}

export interface DeliveryTripItemWithProduct extends DeliveryTripItem {
  product?: {
    id: string;
    category: string;
    product_code: string;
    product_name: string;
    unit: string;
    weight_kg?: number | null;
  };
  /** Effective quantity to deliver = quantity - quantity_picked_up_at_store */
  quantity_to_deliver: number;
}

export interface DeliveryTripCrewWithDetails extends DeliveryTripCrew {
  staff?: {
    id: string;
    name: string;
    employee_code?: string;
    phone?: string;
    /** ผู้ใช้ที่ผูกกับพนักงาน — ใช้ตรวจสิทธิ์ checkout ให้ตรงกับคนขับจริง */
    user_id?: string | null;
  };
}

export interface DeliveryTripWithRelations extends DeliveryTrip {
  vehicle?: {
    plate: string;
    make?: string;
    model?: string;
    image_url?: string | null;
  };
  driver?: {
    full_name: string;
    email?: string;
    avatar_url?: string | null;
  };
  stores?: DeliveryTripStoreWithDetails[];
  crews?: DeliveryTripCrewWithDetails[];
}

export interface DeliveryTripItemChangeWithDetails extends DeliveryTripItemChange {
  product?: {
    id: string;
    product_code: string;
    product_name: string;
    unit: string;
  } | null;
  store?: {
    id: string;
    customer_code: string;
    customer_name: string;
  } | null;
  user?: {
    id: string;
    full_name: string;
  } | null;
}

export interface CreateDeliveryTripData {
  vehicle_id: string;
  driver_id?: string;
  driver_staff_id?: string;
  helpers?: string[];
  planned_date: string;
  odometer_start?: number;
  manual_distance_km?: number;
  notes?: string;
  /** ทริปนี้มีปัญหาข้อมูลการขาย/บิล (คีย์ผิด แก้บิลหลังส่ง ฯลฯ) */
  has_sales_data_issue?: boolean;
  sequence_order?: number;
  stores: Array<{
    store_id: string;
    sequence_order: number;
    items: Array<{
      product_id: string;
      quantity: number;
      quantity_picked_up_at_store?: number;
      notes?: string;
      is_bonus?: boolean;
      selected_pallet_config_id?: string;
      /** หน่วยจากบรรทัดออเดอร์ (เช่น SML); ถ้าไม่ส่งใช้ products.unit ตอนแสดง */
      unit?: string | null;
    }>;
  }>;
}

export interface UpdateDeliveryTripData {
  vehicle_id?: string;
  driver_id?: string;
  driver_staff_id?: string;
  planned_date?: string;
  trip_revenue?: number | null;
  trip_start_date?: string | null;
  trip_end_date?: string | null;
  odometer_start?: number;
  odometer_end?: number;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  has_sales_data_issue?: boolean;
  sequence_order?: number;
  stores?: Array<{
    store_id: string;
    sequence_order: number;
    items: Array<{
      product_id: string;
      quantity: number;
      quantity_picked_up_at_store?: number;
      notes?: string;
      is_bonus?: boolean;
      selected_pallet_config_id?: string;
      /** หน่วยจากบรรทัดออเดอร์ (เช่น SML); ถ้าไม่ส่งใช้ products.unit ตอนแสดง */
      unit?: string | null;
    }>;
  }>;
  helpers?: string[];
  edit_reason?: string;
  change_reason?: string;
}

// Internal use in crud service
export type { DeliveryTrip, DeliveryTripInsert, DeliveryTripUpdate };
