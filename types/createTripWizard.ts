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

/** การแบ่งสินค้าระดับรายการ: key = `${orderId}_${itemId}` → จำนวนที่ขึ้นแต่ละคัน */
export interface ItemSplitQty {
  vehicle1Qty: number;
  vehicle2Qty: number;
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
