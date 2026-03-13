-- ============================================================
-- Reset: ออเดอร์ในทริปที่ยังไม่ completed (planned/in_progress) ไม่ควรขึ้นจัดส่งสำเร็จ/บางส่วน
-- ============================================================
-- กรณี: ออเดอร์ได้จัดทริปแล้ว แต่รถยังไม่ออก (ทริปยังรอจัดส่ง/กำลังจัดส่ง)
-- ถ้ามี quantity_delivered > 0 หรือ status = delivered/partial อยู่ → ผิด (น่าจะจาก bug ก่อนหน้า)
-- Migration นี้ล้าง quantity_delivered และคืน status เป็น assigned
-- ============================================================

-- ล้าง quantity_delivered ของ order_items ที่ออเดอร์อยู่ในทริปที่ยังไม่ completed
UPDATE public.order_items oi
SET quantity_delivered = 0, updated_at = NOW()
FROM public.orders o
JOIN public.delivery_trips dt ON dt.id = o.delivery_trip_id
WHERE oi.order_id = o.id
  AND o.delivery_trip_id IS NOT NULL
  AND dt.status IN ('planned', 'in_progress')
  AND COALESCE(oi.quantity_delivered, 0) > 0;

-- คืน status เป็น assigned สำหรับออเดอร์ในทริปที่ยังไม่ completed แต่ขึ้น delivered/partial อยู่
UPDATE public.orders o
SET status = 'assigned', updated_at = NOW()
FROM public.delivery_trips dt
WHERE o.delivery_trip_id = dt.id
  AND dt.status IN ('planned', 'in_progress')
  AND o.status IN ('delivered', 'partial');
