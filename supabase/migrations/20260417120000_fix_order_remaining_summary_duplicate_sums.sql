-- ============================================================
-- Fix: order_remaining_summary นับยอดรวมผิด (เช่น 500 ชิ้น แสดงเป็น 1000)
-- ============================================================
-- สาเหตุ: VIEW เดิม LEFT JOIN order_item_remaining_quantities (r)
--   กับ order_delivery_trip_allocations (a) ทั้งคู่ที่ order_id เดียวกัน
--   แล้ว SUM(r.*) — แต่ละแถว r ถูกทวีคูณตามจำนวนแถว allocation
--   (ออเดอร์ 1 บรรทัด + 2 ทริป → total_quantity ถูกบวก 2 ครั้ง)
-- แก้: รวมยอดจาก r ใน subquery แยก; นับ trip จาก a ใน subquery แยก;
--   has_any_allocation ใช้ EXISTS ไม่ JOIN a เข้ากับ r
-- ============================================================

CREATE OR REPLACE VIEW public.order_remaining_summary AS
SELECT
  o.id                                 AS order_id,
  o.store_id,
  o.branch,
  o.status                             AS order_status,
  COALESCE(ac.trip_count, 0)           AS trip_count,
  COALESCE(iq.total_remaining, 0)     AS total_remaining,
  COALESCE(iq.total_allocated, 0)     AS total_allocated,
  COALESCE(iq.total_delivery_qty, 0)  AS total_delivery_qty,
  EXISTS (
    SELECT 1
    FROM   public.order_delivery_trip_allocations ax
    WHERE  ax.order_id = o.id
      AND  ax.status <> 'cancelled'
  )                                    AS has_any_allocation
FROM      public.orders o
LEFT JOIN (
  SELECT
    r.order_id,
    COALESCE(
      SUM(r.remaining_unallocated)
      FILTER (WHERE r.fulfillment_method <> 'pickup'),
      0
    )                                    AS total_remaining,
    COALESCE(
      SUM(r.allocated_quantity)
      FILTER (WHERE r.fulfillment_method <> 'pickup'),
      0
    )                                    AS total_allocated,
    COALESCE(
      SUM(r.total_quantity)
      FILTER (WHERE r.fulfillment_method <> 'pickup'),
      0
    )                                    AS total_delivery_qty
  FROM      public.order_item_remaining_quantities r
  GROUP BY  r.order_id
) iq ON iq.order_id = o.id
LEFT JOIN (
  SELECT
    order_id,
    COUNT(DISTINCT delivery_trip_id)
      FILTER (WHERE status <> 'cancelled') AS trip_count
  FROM      public.order_delivery_trip_allocations
  GROUP BY  order_id
) ac ON ac.order_id = o.id;

ALTER VIEW public.order_remaining_summary SET (security_invoker = true);

COMMENT ON VIEW public.order_remaining_summary IS
  'สรุปต่อออเดอร์สำหรับคิวส่งไม่ครบ: ยอดรวมจากรายการสินค้า (ไม่ทวีคูณจากจำนวนทริป/แถว allocation)';
