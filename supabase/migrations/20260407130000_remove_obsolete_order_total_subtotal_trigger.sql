-- ========================================
-- Fix orders.total_amount stuck at 0 when line_total amounts are correct
-- ========================================
-- สาเหตุ: migration ชุดแรก (create_orders_system) สร้าง trigger update_order_total
-- ที่ SET total_amount = (SELECT SUM(subtotal) FROM order_items ...)
-- แต่ตาราง order_items ใช้ line_total ไม่มีคอลัมน์ subtotal → SUM ได้ NULL/0
-- เมื่อมี trigger recalculate_order_total (SUM line_total) อยู่ด้วย ลำดับการรันทำให้
-- ยอดรวมถูกทับเป็นศูนย์ทั้งที่รายการสินค้าถูกต้อง
--
-- ลบ trigger/function เก่า แล้ว backfill ออเดอร์ที่ total_amount เป็น 0 แต่มียอดบรรทัด

DROP TRIGGER IF EXISTS trigger_update_order_total_on_insert ON public.order_items;
DROP TRIGGER IF EXISTS trigger_update_order_total_on_update ON public.order_items;
DROP TRIGGER IF EXISTS trigger_update_order_total_on_delete ON public.order_items;

DROP FUNCTION IF EXISTS public.update_order_total();

-- Backfill จากผลรวม line_total (รวมส่วนลดรายบรรทัดแล้ว)
UPDATE public.orders o
SET
  subtotal = v.sum_line,
  total_amount = GREATEST(
    0::numeric,
    v.sum_line
      - COALESCE(o.discount_amount, 0)
      + COALESCE(o.tax_amount, 0)
  )
FROM (
  SELECT order_id, COALESCE(SUM(line_total), 0)::numeric(12, 2) AS sum_line
  FROM public.order_items
  GROUP BY order_id
) v
WHERE o.id = v.order_id
  AND v.sum_line > 0
  AND (o.total_amount IS NULL OR o.total_amount = 0);
