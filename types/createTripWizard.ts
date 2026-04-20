/** Types for Create Trip From Orders wizard */

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

/**
 * SplitMode:
 * - 'single'    – one vehicle, one trip
 * - '2vehicles' – two vehicles, fixed (backward compat)
 * - '3trips'    – three trips same vehicle, fixed (backward compat)
 * - 'multi'     – N dynamic trip slots (new)
 */
export type SplitMode = 'single' | '2vehicles' | '3trips' | 'multi';

/** Per-item quantity split for legacy 2/3 modes */
export interface ItemSplitQty {
  /** โหมดแบ่ง 2 คัน */
  vehicle1Qty: number;
  vehicle2Qty: number;
  /** โหมดแบ่ง 3 เที่ยว */
  trip1Qty?: number;
  trip2Qty?: number;
  trip3Qty?: number;
}

/** One slot in the dynamic multi-trip wizard */
export interface TripSlot {
  id: string;
  label: string;
  vehicleId: string;
  driverId: string;
}

/**
 * Per-item quantity allocation across dynamic trip slots.
 * key = order_item unique key (see splitKey()), value = map of slotId → quantity
 */
export type MultiTripItemQty = Record<string, Record<string, number>>;

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

/** Create a blank TripSlot */
export function createTripSlot(index: number): TripSlot {
  return {
    id: `slot-${index}`,
    label: `เที่ยวที่ ${index}`,
    vehicleId: '',
    driverId: '',
  };
}
