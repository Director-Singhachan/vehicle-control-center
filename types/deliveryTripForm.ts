/**
 * Types and helpers for delivery trip form (shared between useDeliveryTripForm and DeliveryTripFormView).
 */
export interface StoreWithItems {
  store_id: string;
  sequence_order: number;
  items: Array<{
    item_id?: string;
    product_id: string;
    quantity: number;
    quantity_picked_up_at_store?: number;
    notes?: string;
    selected_pallet_config_id?: string;
  }>;
}

/** Deep compare stores+items; used to avoid sending stores on update when user only changed driver/vehicle/date/notes */
export function storesAndItemsEqual(a: StoreWithItems[], b: StoreWithItems[] | null): boolean {
  if (!b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i], sb = b[i];
    if (sa.store_id !== sb.store_id || sa.sequence_order !== sb.sequence_order) return false;
    if (sa.items.length !== sb.items.length) return false;
    const sortKey = (item: { product_id: string; quantity: number; quantity_picked_up_at_store?: number; notes?: string }) =>
      `${item.product_id}:${item.quantity}:${item.quantity_picked_up_at_store ?? 0}:${item.notes ?? ''}`;
    const aItems = [...sa.items].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
    const bItems = [...sb.items].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
    for (let j = 0; j < aItems.length; j++) {
      if (sortKey(aItems[j]) !== sortKey(bItems[j])) return false;
    }
  }
  return true;
}

export interface DeliveryTripFormData {
  vehicle_id: string;
  driver_id: string;
  planned_date: string;
  odometer_start: string;
  notes: string;
}
