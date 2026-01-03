-- ========================================
-- Verification Query: Check Order Status After Trip Reset
-- ========================================
-- ใช้ query นี้เพื่อตรวจสอบว่าออเดอร์ที่ถูก reset หลังจากลบทริปมี status ที่ถูกต้อง

-- 1. ตรวจสอบออเดอร์ที่ไม่มี delivery_trip_id (ควรจะปรากฏใน pending_orders)
SELECT 
    order_number,
    status,
    delivery_trip_id,
    order_date,
    created_at,
    CASE 
        WHEN status = 'confirmed' AND delivery_trip_id IS NULL 
            THEN '✅ จะปรากฏใน pending_orders'
        WHEN status = 'pending' AND delivery_trip_id IS NULL 
            THEN '⚠️ ไม่ปรากฏใน pending_orders (ต้อง confirm ก่อน)'
        WHEN status = 'assigned' AND delivery_trip_id IS NOT NULL 
            THEN '✅ จัดทริปแล้ว'
        ELSE '❌ สถานะไม่สอดคล้อง'
    END as visibility_status
FROM public.orders
WHERE delivery_trip_id IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 2. ตรวจสอบ pending_orders view (ออเดอร์ที่รอจัดทริป)
SELECT 
    order_number,
    customer_name,
    order_date,
    total_amount,
    items_count,
    total_quantity,
    created_by_name
FROM public.pending_orders
ORDER BY order_date, created_at;

-- 3. ตรวจสอบประวัติการเปลี่ยนสถานะล่าสุด
SELECT 
    o.order_number,
    osh.from_status,
    osh.to_status,
    osh.reason,
    osh.created_at,
    p.full_name as changed_by_name
FROM public.order_status_history osh
JOIN public.orders o ON osh.order_id = o.id
LEFT JOIN public.profiles p ON osh.changed_by = p.id
WHERE osh.reason LIKE '%trip deletion%'
ORDER BY osh.created_at DESC
LIMIT 20;

-- 4. สรุปจำนวนออเดอร์แต่ละ status
SELECT 
    status,
    COUNT(*) as order_count,
    COUNT(CASE WHEN delivery_trip_id IS NULL THEN 1 END) as without_trip,
    COUNT(CASE WHEN delivery_trip_id IS NOT NULL THEN 1 END) as with_trip
FROM public.orders
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'pending' THEN 1
        WHEN 'confirmed' THEN 2
        WHEN 'assigned' THEN 3
        WHEN 'in_delivery' THEN 4
        WHEN 'delivered' THEN 5
        WHEN 'cancelled' THEN 6
    END;
