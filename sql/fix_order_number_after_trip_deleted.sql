-- ========================================
-- แก้เลขออเดอร์ที่ค้างอยู่หลังลบทริป (ก่อนแก้โค้ด)
-- ========================================
-- รันใน Supabase SQL Editor (ต้องมีสิทธิ์ UPDATE ตาราง orders)
--
-- ⚠️ ห้ามแก้แบบทั้งร้าน (WHERE store_id = ... หรือ customer_code = ...)
--    ให้แก้เฉพาะออเดอร์เดียวเท่านั้น (WHERE id = '...' หรือ WHERE order_number = '...')

-- (1) ออเดอร์ที่ทริปถูกลบแล้ว แต่ delivery_trip_id ยังชี้ไปที่ทริปที่ไม่มีอยู่
--     → ล้าง delivery_trip_id, order_number, ตั้ง status = confirmed
UPDATE public.orders o
SET
  delivery_trip_id = NULL,
  order_number = NULL,
  status = 'confirmed',
  updated_at = now()
WHERE o.delivery_trip_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.delivery_trips dt WHERE dt.id = o.delivery_trip_id
  );

-- (2) ออเดอร์ที่ delivery_trip_id = null แล้ว แต่ order_number ยังไม่ถูกล้าง
UPDATE public.orders
SET
  order_number = NULL,
  updated_at = now()
WHERE delivery_trip_id IS NULL
  AND order_number IS NOT NULL;

-- (3) ออเดอร์ที่ไม่มีทริปแล้ว (delivery_trip_id = null) แต่ status ยังเป็น assigned
--     → ตั้ง status = confirmed เพื่อให้สถานะไม่ขึ้น "กำหนดทริปแล้ว"
UPDATE public.orders
SET
  status = 'confirmed',
  updated_at = now()
WHERE delivery_trip_id IS NULL
  AND status = 'assigned';

-- (4) ออเดอร์ที่ผูกทริปที่ยกเลิกแล้ว (trip ยังมีอยู่แต่ status = cancelled)
--     → ล้าง delivery_trip_id, order_number, ตั้ง status = confirmed
UPDATE public.orders o
SET
  delivery_trip_id = NULL,
  order_number = NULL,
  status = 'confirmed',
  updated_at = now()
WHERE o.delivery_trip_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.delivery_trips dt
    WHERE dt.id = o.delivery_trip_id AND dt.status = 'cancelled'
  );

-- (5) ห้ามยกเลิกการผูกทริปทั้งร้าน (โดยใช้ customer_code) — จะทำให้ออเดอร์เก่าของร้านนั้น
--     หลุดจากทริปและเลขออเดอร์หายทั้งหมด
--     ถ้าต้องการยกเลิกการผูกแค่ออเดอร์เดียว ให้ใช้เฉพาะคำสั่งด้านล่าง แทนที่ id หรือ order_number จริง
--
-- UPDATE public.orders
-- SET delivery_trip_id = NULL, order_number = NULL, status = 'confirmed', updated_at = now()
-- WHERE id = 'ใส่-order-id-ตรงนี้';
--
-- หรือ
--
-- UPDATE public.orders
-- SET delivery_trip_id = NULL, order_number = NULL, status = 'confirmed', updated_at = now()
-- WHERE order_number = 'SD2602xxxx';
