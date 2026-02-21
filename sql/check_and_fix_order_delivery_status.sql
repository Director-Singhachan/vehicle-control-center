-- ============================================================
-- Script: ตรวจสอบและแก้ไข quantity_delivered สำหรับออเดอร์ที่ส่งแล้วแต่ยังไม่แสดง
-- ============================================================
-- ใช้สำหรับตรวจสอบว่าทำไม "ส่งแล้ว" ไม่ขึ้นใน UI
-- และแก้ไขโดยการรัน backfill สำหรับทริปที่เกี่ยวข้อง
-- ============================================================

-- 1. ตรวจสอบ trigger ว่ามีอยู่หรือไม่
-- ============================================================
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trg_sync_fulfilled_on_trip_complete'
  AND tgrelid = 'public.delivery_trips'::regclass;

-- 2. ตรวจสอบออเดอร์ SD260220010 (หรือเปลี่ยน order_number ตามต้องการ)
-- ============================================================
DO $$
DECLARE
    v_order_number text := 'SD260220010';  -- เปลี่ยนตามออเดอร์ที่ต้องการตรวจสอบ
    v_order_id uuid;
    v_trip_id uuid;
    v_trip_status text;
    v_trip_number text;
BEGIN
    -- หา order_id
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE order_number = v_order_number;
    
    IF v_order_id IS NULL THEN
        RAISE NOTICE 'ไม่พบออเดอร์: %', v_order_number;
        RETURN;
    END IF;
    
    -- แสดงข้อมูลออเดอร์
    RAISE NOTICE '=== ข้อมูลออเดอร์ ===';
    RAISE NOTICE 'Order ID: %', v_order_id;
    RAISE NOTICE 'Order Number: %', v_order_number;
    
    -- หาทริปที่ผูกกับออเดอร์นี้ (ผ่าน delivery_trip_stores)
    SELECT DISTINCT dt.id, dt.status, dt.trip_number
    INTO v_trip_id, v_trip_status, v_trip_number
    FROM public.delivery_trips dt
    JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = dt.id
    JOIN public.orders o ON o.store_id = dts.store_id
    WHERE o.id = v_order_id
    ORDER BY dt.created_at DESC
    LIMIT 1;
    
    IF v_trip_id IS NOT NULL THEN
        RAISE NOTICE '=== ข้อมูลทริป ===';
        RAISE NOTICE 'Trip ID: %', v_trip_id;
        RAISE NOTICE 'Trip Number: %', v_trip_number;
        RAISE NOTICE 'Trip Status: %', v_trip_status;
        
        IF v_trip_status = 'completed' THEN
            RAISE NOTICE '✅ ทริปนี้ completed แล้ว - ควรจะอัปเดต quantity_delivered แล้ว';
            RAISE NOTICE 'กำลังรัน backfill สำหรับทริปนี้...';
            
            -- รัน backfill
            PERFORM public.backfill_quantity_delivered_for_trip(v_trip_id);
            
            RAISE NOTICE '✅ รัน backfill เสร็จแล้ว - ตรวจสอบผลลัพธ์ด้านล่าง';
        ELSE
            RAISE NOTICE '⚠️ ทริปนี้ยังไม่ completed (status: %) - trigger จะทำงานเมื่อทริปเปลี่ยนเป็น completed', v_trip_status;
        END IF;
    ELSE
        RAISE NOTICE '⚠️ ไม่พบทริปที่ผูกกับออเดอร์นี้';
    END IF;
END $$;

-- 3. แสดงผลลัพธ์: order_items ของออเดอร์นี้ (หลัง backfill ถ้ารัน)
-- ============================================================
SELECT 
    o.order_number,
    o.status AS order_status,
    oi.product_id,
    p.product_code,
    p.product_name,
    oi.quantity AS ordered_qty,
    COALESCE(oi.quantity_picked_up_at_store, 0) AS picked_up,
    COALESCE(oi.quantity_delivered, 0) AS delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.order_number = 'SD260220010'  -- เปลี่ยนตามออเดอร์ที่ต้องการ
ORDER BY oi.created_at;

-- 4. แสดง delivery_trip_items ที่ส่งให้ร้านของออเดอร์นี้ (จากทริปที่ completed)
-- ============================================================
SELECT 
    dt.trip_number,
    dt.status AS trip_status,
    dts.store_id,
    dti.product_id,
    p.product_code,
    p.product_name,
    dti.quantity AS trip_item_qty
FROM public.delivery_trips dt
JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = dt.id
JOIN public.delivery_trip_items dti ON dti.delivery_trip_store_id = dts.id
JOIN public.orders o ON o.store_id = dts.store_id
LEFT JOIN public.products p ON p.id = dti.product_id
WHERE o.order_number = 'SD260220010'  -- เปลี่ยนตามออเดอร์ที่ต้องการ
  AND dt.status = 'completed'
ORDER BY dt.created_at DESC, dti.created_at;

-- 5. ตรวจสอบว่ามีทริปที่ completed แล้วแต่ยังไม่ได้อัปเดต quantity_delivered หรือไม่
-- ============================================================
-- (เปรียบเทียบยอดจาก delivery_trip_items กับ order_items.quantity_delivered)
SELECT 
    o.order_number,
    oi.product_id,
    p.product_code,
    p.product_name,
    oi.quantity AS ordered_qty,
    COALESCE(oi.quantity_delivered, 0) AS current_delivered,
    COALESCE(SUM(dti.quantity), 0) AS should_be_delivered,
    CASE 
        WHEN COALESCE(oi.quantity_delivered, 0) < COALESCE(SUM(dti.quantity), 0) THEN '❌ ไม่ตรง - ต้องอัปเดต'
        ELSE '✅ ตรง'
    END AS status_check
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.products p ON p.id = oi.product_id
LEFT JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id
LEFT JOIN public.delivery_trips dt ON dt.id = dts.delivery_trip_id AND dt.status = 'completed'
LEFT JOIN public.delivery_trip_items dti ON dti.delivery_trip_store_id = dts.id AND dti.product_id = oi.product_id
WHERE o.order_number = 'SD260220010'  -- เปลี่ยนตามออเดอร์ที่ต้องการ
GROUP BY o.order_number, oi.id, oi.product_id, p.product_code, p.product_name, oi.quantity, oi.quantity_delivered
HAVING COALESCE(oi.quantity_delivered, 0) < COALESCE(SUM(dti.quantity), 0)
ORDER BY oi.created_at;
