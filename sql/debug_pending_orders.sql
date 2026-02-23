-- ============================================================
-- ดีบักหน้า "ออเดอร์ที่รอจัดทริป" — เหตุผลที่แสดง/ไม่แสดง
-- ============================================================
-- รันใน Supabase Dashboard → SQL Editor
--
-- Logic แอป: แสดงเฉพาะออเดอร์ที่
--   1. delivery_trip_id IS NULL (ยังไม่จัดทริป)
--   2. status IN (confirmed, partial, assigned)
--   3. remaining > 0 (สั่ง - รับที่ร้าน - ส่งแล้ว)
--   4. order_number ไม่ใช่รูปแบบเก่า (-ORD-)
--   5. กรอง branch ถ้าเลือกไว้
-- ============================================================

-- 1. ออเดอร์ที่ควรรอจัดทริป (delivery_trip_id IS NULL, status ไม่ใช่ delivered)
--    นี่คือฐาน — ถ้ามี 4 ออเดอร์ แต่หน้าแสดง 1 แปลว่ามีอะไรกรองออกไป
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.delivery_trip_id,
    o.branch,
    s.customer_name,
    o.order_date,
    o.created_at
FROM public.orders o
LEFT JOIN public.stores s ON s.id = o.store_id
WHERE o.delivery_trip_id IS NULL
  AND o.status IN ('confirmed', 'partial', 'assigned')
  AND (o.order_number IS NULL OR o.order_number NOT LIKE '%-ORD-%')  -- ไม่ใช้รหัสเก่า
ORDER BY o.created_at ASC;

-- 2. แสดง remaining ต่อออเดอร์ (คำนวณเหมือนแอป)
--    remaining = สั่ง - รับที่ร้าน - ส่งแล้ว (ใช้ order_items.quantity_delivered เท่านั้น สำหรับออเดอร์ที่ยังไม่มีทริป)
SELECT 
    o.order_number,
    s.customer_name,
    o.status,
    o.branch,
    SUM(oi.quantity) AS total_ordered,
    SUM(COALESCE(oi.quantity_picked_up_at_store, 0)) AS total_picked_up,
    SUM(COALESCE(oi.quantity_delivered, 0)) AS total_delivered,
    SUM(oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining,
    CASE 
        WHEN SUM(oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) > 0 
        THEN '✅ ควรแสดง'
        ELSE '❌ ไม่แสดง (remaining=0)'
    END AS will_show
FROM public.orders o
LEFT JOIN public.stores s ON s.id = o.store_id
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.delivery_trip_id IS NULL
  AND o.status IN ('confirmed', 'partial', 'assigned')
  AND o.status != 'delivered'
  AND (o.order_number IS NULL OR o.order_number NOT LIKE '%-ORD-%')
GROUP BY o.id, o.order_number, s.customer_name, o.status, o.branch
ORDER BY o.created_at ASC;

-- 3. สรุปจำนวน — เทียบกับที่แอปแสดง
SELECT 
    'ออเดอร์ที่ delivery_trip_id IS NULL' AS criteria,
    COUNT(*) AS count
FROM public.orders o
WHERE o.delivery_trip_id IS NULL
  AND o.status IN ('confirmed', 'partial', 'assigned')
  AND (o.order_number IS NULL OR o.order_number NOT LIKE '%-ORD-%')

UNION ALL

SELECT 
    'ออเดอร์ที่ remaining > 0' AS criteria,
    COUNT(*) AS count
FROM (
    SELECT o.id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.delivery_trip_id IS NULL
      AND o.status IN ('confirmed', 'partial', 'assigned')
      AND o.status != 'delivered'
      AND (o.order_number IS NULL OR o.order_number NOT LIKE '%-ORD-%')
    GROUP BY o.id
    HAVING SUM(oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) > 0
) sub;

-- 4. แยกตามสาขา (กรอง branch อาจทำให้หาย)
SELECT 
    COALESCE(o.branch, 'NULL') AS branch,
    COUNT(DISTINCT o.id) AS order_count,
    STRING_AGG(o.order_number, ', ') AS order_numbers
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.delivery_trip_id IS NULL
  AND o.status IN ('confirmed', 'partial', 'assigned')
  AND (o.order_number IS NULL OR o.order_number NOT LIKE '%-ORD-%')
  AND o.id IN (
    SELECT o2.id FROM public.orders o2
    JOIN public.order_items oi2 ON oi2.order_id = o2.id
    WHERE o2.delivery_trip_id IS NULL
      AND o2.status IN ('confirmed', 'partial', 'assigned')
    GROUP BY o2.id
    HAVING SUM(oi2.quantity - COALESCE(oi2.quantity_picked_up_at_store, 0) - COALESCE(oi2.quantity_delivered, 0)) > 0
  )
GROUP BY o.branch;

-- 5. รายการออเดอร์ที่ควรแสดงใน "ออเดอร์ที่รอจัดทริป" (ตาม logic แอป)
SELECT 
    o.order_number,
    s.customer_name,
    o.status,
    o.branch,
    o.order_date,
    SUM(oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
LEFT JOIN public.stores s ON s.id = o.store_id
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.delivery_trip_id IS NULL
  AND o.status IN ('confirmed', 'partial', 'assigned')
  AND o.status != 'delivered'
  AND (o.order_number IS NULL OR o.order_number NOT LIKE '%-ORD-%')
GROUP BY o.id, o.order_number, s.customer_name, o.status, o.branch, o.order_date, o.created_at
HAVING SUM(oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) > 0
ORDER BY o.order_date, o.created_at;
