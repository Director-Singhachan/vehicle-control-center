-- ========================================
-- Fix Existing Orders: Reset orphaned orders to confirmed
-- ========================================
-- แก้ไขออเดอร์ที่ delivery_trip_id ชี้ไปหาทริปที่ไม่มีอยู่แล้ว
-- หรือออเดอร์ที่มี status ไม่สอดคล้องกับ delivery_trip_id

-- Step 1: ค้นหาออเดอร์ที่มีปัญหา
DO $$
DECLARE
    v_fixed_count INTEGER := 0;
    v_order_record RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'กำลังตรวจสอบและแก้ไขออเดอร์ที่มีปัญหา...';
    RAISE NOTICE '========================================';

    -- Case 1: ออเดอร์ที่มี delivery_trip_id แต่ทริปไม่มีอยู่จริง
    FOR v_order_record IN
        SELECT o.id, o.order_number, o.status, o.delivery_trip_id
        FROM public.orders o
        WHERE o.delivery_trip_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.delivery_trips dt
              WHERE dt.id = o.delivery_trip_id
          )
    LOOP
        RAISE NOTICE 'พบออเดอร์ % (status: %) มี delivery_trip_id ที่ไม่มีอยู่แล้ว', 
            v_order_record.order_number, v_order_record.status;

        -- บันทึกประวัติการเปลี่ยนแปลง
        INSERT INTO public.order_status_history (order_id, from_status, to_status, reason, created_at)
        VALUES (
            v_order_record.id,
            v_order_record.status,
            'confirmed',
            'Fixed: Reset to confirmed - delivery trip no longer exists',
            now()
        );

        -- Update ออเดอร์
        UPDATE public.orders
        SET 
            delivery_trip_id = NULL,
            status = 'confirmed',
            updated_at = now()
        WHERE id = v_order_record.id;

        v_fixed_count := v_fixed_count + 1;
    END LOOP;

    -- Case 2: ออเดอร์ที่มี status = 'assigned' แต่ไม่มี delivery_trip_id
    FOR v_order_record IN
        SELECT o.id, o.order_number, o.status, o.delivery_trip_id
        FROM public.orders o
        WHERE o.status = 'assigned'
          AND o.delivery_trip_id IS NULL
    LOOP
        RAISE NOTICE 'พบออเดอร์ % มี status = assigned แต่ไม่มี delivery_trip_id', 
            v_order_record.order_number;

        -- บันทึกประวัติการเปลี่ยนแปลง
        INSERT INTO public.order_status_history (order_id, from_status, to_status, reason, created_at)
        VALUES (
            v_order_record.id,
            'assigned',
            'confirmed',
            'Fixed: Reset to confirmed - no delivery trip assigned',
            now()
        );

        -- Update ออเดอร์
        UPDATE public.orders
        SET 
            status = 'confirmed',
            updated_at = now()
        WHERE id = v_order_record.id;

        v_fixed_count := v_fixed_count + 1;
    END LOOP;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'แก้ไขเสร็จสิ้น: % รายการ', v_fixed_count;
    RAISE NOTICE '========================================';

    IF v_fixed_count = 0 THEN
        RAISE NOTICE 'ไม่พบออเดอร์ที่ต้องแก้ไข';
    END IF;
END $$;

-- Step 2: ตรวจสอบผลลัพธ์
SELECT 
    '✅ Orders in pending_orders view' as status,
    COUNT(*) as count
FROM public.pending_orders

UNION ALL

SELECT 
    '📊 Orders with confirmed status and no trip' as status,
    COUNT(*) as count
FROM public.orders
WHERE status = 'confirmed' AND delivery_trip_id IS NULL

UNION ALL

SELECT 
    '⚠️ Orders with orphaned trip_id' as status,
    COUNT(*) as count
FROM public.orders o
WHERE o.delivery_trip_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.delivery_trips dt
      WHERE dt.id = o.delivery_trip_id
  )

UNION ALL

SELECT 
    '❌ Orders with status=assigned but no trip' as status,
    COUNT(*) as count
FROM public.orders
WHERE status = 'assigned' AND delivery_trip_id IS NULL;

-- Step 3: แสดงออเดอร์ที่ถูกแก้ไข
SELECT 
    o.order_number,
    o.status,
    o.delivery_trip_id,
    osh.from_status,
    osh.to_status,
    osh.reason,
    osh.created_at as fixed_at
FROM public.order_status_history osh
JOIN public.orders o ON osh.order_id = o.id
WHERE osh.reason LIKE 'Fixed:%'
ORDER BY osh.created_at DESC
LIMIT 20;
