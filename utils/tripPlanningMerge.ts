/** รวมบรรทัดสินค้าระหว่างหลายออเดอร์ของรายร้านเดียว (ส่งเข้าสร้างทริปครั้งเดียวได้ ไม่ให้เกิด store ซ้อนใน payload) */

export interface MergedTripLineItem {
  product_id: string;
  quantity: number;
  unit?: string | null;
  is_bonus: boolean;
}

export function mergeOrderItemsAcrossOrders(
  orders: Array<{ items?: Array<{ product_id: string; quantity: number; unit?: string | null; is_bonus?: boolean | null }> }>,
): MergedTripLineItem[] {
  const map = new Map<string, MergedTripLineItem>();
  for (const o of orders) {
    for (const it of o.items ?? []) {
      const pid = it.product_id;
      const q = Number(it.quantity) || 0;
      if (q <= 0) continue;
      const prev = map.get(pid);
      if (!prev) {
        map.set(pid, {
          product_id: pid,
          quantity: q,
          unit: it.unit ?? null,
          is_bonus: !!it.is_bonus,
        });
      } else {
        prev.quantity += q;
        if (!prev.unit && it.unit) prev.unit = it.unit;
        prev.is_bonus = prev.is_bonus || !!it.is_bonus;
      }
    }
  }
  return Array.from(map.values());
}

/** รวมยอดสินค้าตาม SKU ระหว่างหลายร้านในเที่ยวเดียว (บอร์ดจัดคิว) */
export interface TripAggregatedProductLine {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string | null;
}

export function aggregateTripProductLines(
  storeLineGroups: readonly {
    line_items?: ReadonlyArray<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit?: string | null;
    }>;
  }[],
): TripAggregatedProductLine[] {
  const map = new Map<string, TripAggregatedProductLine>();
  for (const g of storeLineGroups) {
    for (const line of g.line_items ?? []) {
      const prev = map.get(line.product_id);
      const unit = line.unit != null && String(line.unit).trim() !== '' ? String(line.unit).trim() : null;
      if (!prev) {
        map.set(line.product_id, {
          product_id: line.product_id,
          product_name: line.product_name,
          quantity: line.quantity,
          unit,
        });
      } else {
        prev.quantity += line.quantity;
        if (!prev.unit && unit) prev.unit = unit;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name, 'th'));
}
