-- ============================================================
-- แก้ไข quantity_delivered สำหรับออเดอร์ที่ลบทริปไปแล้ว
-- แต่ quantity_delivered ยังไม่ถูกรีเซ็ต (แสดง "ส่งแล้ว" ผิด)
-- ============================================================
-- กรณี: ออเดอร์มี delivery_trip_id = NULL (ลบทริปแล้ว) แต่ quantity_delivered > 0
-- และไม่มีทริป completed อื่นที่ส่งให้ร้านนี้ → ควร reset quantity_delivered = 0
-- ============================================================

-- 1. ดูออเดอร์ที่อาจมีปัญหา
SELECT 
    o.order_number,
    s.customer_name,
    oi.quantity,
    oi.quantity_picked_up_at_store,
    oi.quantity_delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
JOIN public.stores s ON s.id = o.store_id
WHERE o.delivery_trip_id IS NULL
  AND o.status IN ('confirmed', 'partial', 'assigned')
  AND COALESCE(oi.quantity_delivered, 0) > 0;

-- 2. รันเพื่อรีเซ็ต quantity_delivered สำหรับออเดอร์ที่ลบทริปแล้ว (delivery_trip_id IS NULL)
-- ออเดอร์ที่ไม่มีทริป = ยังไม่มีการจัดส่ง → quantity_delivered ควรเป็น 0
UPDATE public.order_items oi
SET 
    quantity_delivered = 0,
    updated_at = NOW()
WHERE oi.order_id IN (
    SELECT o.id FROM public.orders o
    WHERE o.delivery_trip_id IS NULL
      AND o.status IN ('confirmed', 'partial', 'assigned')
)
AND COALESCE(oi.quantity_delivered, 0) > 0;

-- 3. ตรวจสอบผลหลังแก้
SELECT 
    o.order_number,
    s.customer_name,
    oi.quantity,
    oi.quantity_picked_up_at_store,
    oi.quantity_delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
JOIN public.stores s ON s.id = o.store_id
WHERE o.delivery_trip_id IS NULL
  AND o.status IN ('confirmed', 'partial', 'assigned')
ORDER BY o.order_number;
