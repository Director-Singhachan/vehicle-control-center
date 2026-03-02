/** Types for Create Trip From Orders wizard (Phase 3.3) */

export interface StoreDelivery {
  id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  store_code: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  order_number: string;
  total_amount: number;
  sequence: number;
  delivery_date: string | null;
}

export type SplitMode = 'single' | '2vehicles' | '3trips';

/** การแบ่งสินค้าระดับรายการ: key = `${orderId}_${itemId}` → จำนวนที่ขึ้นแต่ละคัน/เที่ยว */
export interface ItemSplitQty {
  /** โหมดแบ่ง 2 คัน */
  vehicle1Qty: number;
  vehicle2Qty: number;
  /** โหมดแบ่ง 3 เที่ยว (ใช้เมื่อ splitMode = '3trips') */
  trip1Qty?: number;
  trip2Qty?: number;
  trip3Qty?: number;
}

export type CapacitySummary = {
  totalPallets: number;
  totalWeightKg: number;
  totalHeightCm: number;
  vehicleMaxPallets: number | null;
  vehicleMaxWeightKg: number | null;
  vehicleMaxHeightCm: number | null;
  loading: boolean;
  errors: string[];
  warnings: string[];
};

export function splitKey(orderId: string, itemId: string): string {
  return `${orderId}_${itemId}`;
}
