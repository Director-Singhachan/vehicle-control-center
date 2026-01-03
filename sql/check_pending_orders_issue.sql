-- ========================================
-- Debug: ทำไมออเดอร์ที่ reset แล้วไม่ขึ้นในหน้า "รอจัดทริป"
-- ========================================

-- 1. ตรวจสอบออเดอร์ที่มี status = 'confirmed' และ delivery_trip_id IS NULL
SELECT 
    order_number,
    status,
    delivery_trip_id,
    order_date,
    confirmed_at,
    confirmed_by,
    created_at
FROM public.orders
WHERE status = 'confirmed' 
  AND delivery_trip_id IS NULL
ORDER BY created_at DESC;

-- 2. ตรวจสอบว่า pending_orders view แสดงอะไร
SELECT 
    order_number,
    customer_code,
    customer_name,
    status,
    delivery_trip_id,
    order_date,
    total_amount
FROM public.pending_orders
ORDER BY order_date, created_at;

-- 3. ตรวจสอบประวัติการเปลี่ยนสถานะ (ดูว่า cleanup script run แล้วหรือยัง)
SELECT 
    o.order_number,
    osh.from_status,
    osh.to_status,
    osh.reason,
    osh.created_at
FROM public.order_status_history osh
JOIN public.orders o ON osh.order_id = o.id
WHERE osh.reason LIKE '%trip deletion%'
   OR osh.reason LIKE '%Reset to%'
ORDER BY osh.created_at DESC
LIMIT 20;

-- 4. ตรวจสอบออเดอร์จากรูปที่ user ส่งมา (ORD-2601-0005, 0004, 0003, 0002, 0001)
SELECT 
    order_number,
    status,
    delivery_trip_id,
    order_date,
    total_amount,
    confirmed_at,
    confirmed_by,
    CASE 
        WHEN status = 'confirmed' AND delivery_trip_id IS NULL 
            THEN '✅ ควรขึ้น pending_orders'
        ELSE '❌ ไม่ควรขึ้น pending_orders'
    END as should_appear_in_pending
FROM public.orders
WHERE order_number IN ('ORD-2601-0005', 'ORD-2601-0004', 'ORD-2601-0003', 'ORD-2601-0002', 'ORD-2601-0001')
ORDER BY order_number DESC;

-- 5. เปรียบเทียบ orders กับ pending_orders view
SELECT 
    'ใน orders table' as source,
    COUNT(*) as count
FROM public.orders
WHERE status = 'confirmed' AND delivery_trip_id IS NULL

UNION ALL

SELECT 
    'ใน pending_orders view' as source,
    COUNT(*) as count
FROM public.pending_orders;

-- 6. ดู definition ของ pending_orders view
SELECT 
    pg_get_viewdef('public.pending_orders'::regclass, true) as view_definition;
