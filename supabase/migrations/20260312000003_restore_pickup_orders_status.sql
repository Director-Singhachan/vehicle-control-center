-- ============================================================
-- Restore: คืนสถานะ "จัดส่งสำเร็จ มารับเอง" ให้ออเดอร์รับเองที่ถูก reset ผิด
-- ============================================================
-- Migration 20260312000002 รีเซ็ต status ของออเดอร์ที่ delivery_trip_id IS NULL ทั้งหมด
-- รวมถึงออเดอร์รับเองที่ลูกค้ามารับแล้ว (status ถูกต้องเป็น delivered)
-- Migration นี้คืน status = 'delivered' ให้ออเดอร์ที่ fulfill ครบจาก quantity_picked_up_at_store
-- ============================================================

UPDATE public.orders o
SET status = 'delivered', updated_at = NOW()
WHERE o.delivery_trip_id IS NULL
  AND o.status = 'confirmed'
  AND (
    SELECT COALESCE(SUM(oi.quantity_picked_up_at_store), 0) + COALESCE(SUM(oi.quantity_delivered), 0)
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  ) >= (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  )
  AND (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  ) > 0;
