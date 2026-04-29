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
