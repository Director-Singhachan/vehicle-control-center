/**
 * ยอดรวมสำหรับแสดงในรายการออเดอร์ — ใช้ display_total_amount จาก view orders_with_details (ถ้ามี)
 * เมื่อ orders.total_amount เป็น 0 แต่มีรายการสินค้า view จะสะท้อนผลรวม line_total
 */
export function getOrderDisplayTotalAmount(order: {
  display_total_amount?: number | null;
  total_amount?: number | null;
}): number {
  const d = order.display_total_amount;
  if (d != null && Number.isFinite(Number(d))) {
    return Number(d);
  }
  return Number(order.total_amount ?? 0);
}
