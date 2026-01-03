-- ========================================
-- ตรวจสอบสถานะของ ORD-2601-0001 และ ORD-2601-0002
-- ========================================

-- 1. ดูข้อมูลออเดอร์ปัจจุบัน
SELECT 
    order_number,
    status,
    delivery_trip_id,
    order_date,
    confirmed_at,
    confirmed_by,
    created_at,
    updated_at,
    CASE 
        WHEN delivery_trip_id IS NOT NULL THEN 'มี trip_id: ' || delivery_trip_id::text
        ELSE 'ไม่มี trip_id'
    END as trip_status
FROM public.orders
WHERE order_number IN ('ORD-2601-0001', 'ORD-2601-0002', 'ORD-2601-0003', 'ORD-2601-0004', 'ORD-2601-0005')
ORDER BY order_number;

-- 2. ตรวจสอบว่า delivery_trip_id ที่ชี้อยู่ยังมีทริปอยู่ไหม
SELECT 
    o.order_number,
    o.delivery_trip_id,
    dt.trip_number as trip_exists,
    CASE 
        WHEN dt.id IS NULL AND o.delivery_trip_id IS NOT NULL 
            THEN '❌ ทริปไม่มีอยู่แล้ว (orphaned)'
        WHEN dt.id IS NOT NULL 
            THEN '✅ ทริปยังมีอยู่'
        ELSE 'ไม่มี trip_id'
    END as trip_check
FROM public.orders o
LEFT JOIN public.delivery_trips dt ON o.delivery_trip_id = dt.id
WHERE o.order_number IN ('ORD-2601-0001', 'ORD-2601-0002', 'ORD-2601-0003', 'ORD-2601-0004', 'ORD-2601-0005')
ORDER BY o.order_number;

-- 3. ดูประวัติการเปลี่ยนสถานะ
SELECT 
    o.order_number,
    osh.from_status,
    osh.to_status,
    osh.reason,
    osh.created_at,
    p.full_name as changed_by
FROM public.order_status_history osh
JOIN public.orders o ON osh.order_id = o.id
LEFT JOIN public.profiles p ON osh.changed_by = p.id
WHERE o.order_number IN ('ORD-2601-0001', 'ORD-2601-0002', 'ORD-2601-0003', 'ORD-2601-0004', 'ORD-2601-0005')
ORDER BY o.order_number, osh.created_at DESC;

-- 4. ตรวจสอบว่าทริป DT-2601-0001 ถึง 0005 ยังมีอยู่ไหม
SELECT 
    trip_number,
    status,
    planned_date,
    created_at
FROM public.delivery_trips
WHERE trip_number LIKE 'DT-2601-%'
ORDER BY trip_number;

-- 5. แสดงข้อมูลสรุป
SELECT 
    'ORD-2601-0001' as order_number,
    (SELECT status FROM public.orders WHERE order_number = 'ORD-2601-0001') as current_status,
    (SELECT delivery_trip_id FROM public.orders WHERE order_number = 'ORD-2601-0001') as has_trip_id,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.pending_orders WHERE order_number = 'ORD-2601-0001') > 0 
            THEN '✅ แสดงใน pending_orders'
        ELSE '❌ ไม่แสดงใน pending_orders'
    END as in_pending_view

UNION ALL

SELECT 
    'ORD-2601-0002' as order_number,
    (SELECT status FROM public.orders WHERE order_number = 'ORD-2601-0002') as current_status,
    (SELECT delivery_trip_id FROM public.orders WHERE order_number = 'ORD-2601-0002') as has_trip_id,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.pending_orders WHERE order_number = 'ORD-2601-0002') > 0 
            THEN '✅ แสดงใน pending_orders'
        ELSE '❌ ไม่แสดงใน pending_orders'
    END as in_pending_view;
