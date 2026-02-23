-- ============================================================
-- ตรวจสอบสถานะออเดอร์ SD260221001
-- ============================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → วางโค้ดนี้ → Run
-- หรือใช้ psql ต่อกับ database แล้วรัน
-- ============================================================

-- 1. ข้อมูลออเดอร์หลัก (orders)
SELECT 
    o.id AS order_id,
    o.order_number,
    o.status AS order_status,
    o.delivery_trip_id,
    o.order_date,
    s.customer_name,
    s.id AS store_id
FROM public.orders o
LEFT JOIN public.stores s ON s.id = o.store_id
WHERE o.order_number = 'SD260221001';

-- 2. รายการสินค้าในออเดอร์ (order_items) + สถานะจัดส่ง
SELECT 
    o.order_number,
    o.status AS order_status,
    p.product_code,
    p.product_name,
    oi.quantity AS ordered_qty,
    COALESCE(oi.quantity_picked_up_at_store, 0) AS picked_up_at_store,
    COALESCE(oi.quantity_delivered, 0) AS delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.order_number = 'SD260221001'
ORDER BY oi.created_at;

-- 3. ทริปที่ผูกอยู่ (ถ้ามี)
SELECT 
    dt.id AS trip_id,
    dt.trip_number,
    dt.status AS trip_status,
    dt.planned_date
FROM public.orders o
JOIN public.delivery_trips dt ON dt.id = o.delivery_trip_id
WHERE o.order_number = 'SD260221001';
