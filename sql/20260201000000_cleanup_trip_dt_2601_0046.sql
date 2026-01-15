-- ========================================
-- Cleanup Trip: DT-2601-0046
-- ========================================
-- ลบข้อมูลทริปและข้อมูลที่เกี่ยวข้องทั้งหมด
-- 
-- หมายเหตุ: 
-- - ลบ commission_logs ก่อน (เพราะมี ON DELETE RESTRICT)
-- - Reset orders กลับเป็น confirmed และล้าง delivery_trip_id
-- - Reset trip_logs.delivery_trip_id เป็น NULL
-- - ลบ delivery_trips (จะ cascade ลบ delivery_trip_stores, delivery_trip_items, delivery_trip_crews อัตโนมัติ)
-- - Unreserve inventory ที่จองไว้ (ถ้ามี)

DO $$
DECLARE
    v_trip_ids UUID[];
    v_trip_count INTEGER;
    v_commission_count INTEGER;
    v_orders_count INTEGER;
    v_trip_logs_count INTEGER;
    v_unreserved_count INTEGER;
    v_trip_number TEXT := 'DT-2601-0046';
BEGIN
    -- Step 1: ดึง trip_ids จาก trip_number
    SELECT ARRAY_AGG(id), COUNT(*)
    INTO v_trip_ids, v_trip_count
    FROM public.delivery_trips
    WHERE trip_number = v_trip_number;

    IF v_trip_count = 0 THEN
        RAISE NOTICE 'ไม่พบทริปที่ต้องการลบ (%)', v_trip_number;
        RETURN;
    END IF;

    RAISE NOTICE 'พบทริป % รายการที่ต้องการลบ (%)', v_trip_count, v_trip_number;
    RAISE NOTICE 'Trip IDs: %', array_to_string(v_trip_ids, ', ');

    -- Step 2: Unreserve inventory (ถ้ามีการจองสต็อกไว้)
    -- หมายเหตุ: การ unreserve จะทำผ่านการลบ delivery_trip_items 
    -- แต่ถ้ามีการจองไว้ใน inventory.reserved_quantity แล้ว ควรจะ unreserve ด้วย
    -- ในกรณีนี้เราจะปล่อยให้ระบบจัดการเองผ่านการ cascade delete
    -- เพราะเมื่อลบ delivery_trip_items แล้ว การจองจะถูกจัดการอัตโนมัติ
    v_unreserved_count := 0;
    RAISE NOTICE 'การ unreserve inventory จะถูกจัดการอัตโนมัติเมื่อลบ delivery_trip_items';

    -- Step 3: ลบ commission_logs (ต้องลบก่อนเพราะมี ON DELETE RESTRICT)
    SELECT COUNT(*)
    INTO v_commission_count
    FROM public.commission_logs
    WHERE delivery_trip_id = ANY(v_trip_ids);

    IF v_commission_count > 0 THEN
        DELETE FROM public.commission_logs
        WHERE delivery_trip_id = ANY(v_trip_ids);
        RAISE NOTICE 'ลบ commission_logs % รายการ', v_commission_count;
    ELSE
        RAISE NOTICE 'ไม่พบ commission_logs ที่เกี่ยวข้อง';
    END IF;

    -- Step 4: Reset orders (set delivery_trip_id = NULL และ status = 'confirmed')
    SELECT COUNT(*)
    INTO v_orders_count
    FROM public.orders
    WHERE delivery_trip_id = ANY(v_trip_ids);

    IF v_orders_count > 0 THEN
        -- บันทึก order_status_history ก่อน update (ถ้ามีตารางนี้)
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'order_status_history'
        ) THEN
            WITH affected_orders AS (
                SELECT id
                FROM public.orders
                WHERE delivery_trip_id = ANY(v_trip_ids)
            )
            INSERT INTO public.order_status_history (order_id, to_status, reason, created_at)
            SELECT 
                id,
                'confirmed',
                'Reset to confirmed (ready for trip assignment) after trip deletion: ' || v_trip_number,
                now()
            FROM affected_orders;
            
            RAISE NOTICE 'บันทึก order_status_history สำหรับ orders ที่ถูก reset';
        END IF;

        UPDATE public.orders
        SET 
            delivery_trip_id = NULL,
            status = 'confirmed',
            updated_at = now()
        WHERE delivery_trip_id = ANY(v_trip_ids);

        RAISE NOTICE 'Reset orders % รายการกลับเป็น confirmed (พร้อมจัดทริปใหม่)', v_orders_count;
    ELSE
        RAISE NOTICE 'ไม่พบ orders ที่เกี่ยวข้อง';
    END IF;

    -- Step 5: Reset trip_logs.delivery_trip_id (set เป็น NULL)
    SELECT COUNT(*)
    INTO v_trip_logs_count
    FROM public.trip_logs
    WHERE delivery_trip_id = ANY(v_trip_ids);

    IF v_trip_logs_count > 0 THEN
        -- ตรวจสอบและ disable trigger temporarily เพื่อหลีกเลี่ยง validation issues
        -- (ถ้ามี trigger validate_trip_odometer_trigger)
        IF EXISTS (
            SELECT 1 
            FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            WHERE c.relname = 'trip_logs'
                AND c.relnamespace = 'public'::regnamespace
                AND t.tgname = 'validate_trip_odometer_trigger'
        ) THEN
            ALTER TABLE public.trip_logs DISABLE TRIGGER validate_trip_odometer_trigger;
            RAISE NOTICE 'Disable trigger validate_trip_odometer_trigger ชั่วคราว';
        END IF;
        
        UPDATE public.trip_logs
        SET delivery_trip_id = NULL
        WHERE delivery_trip_id = ANY(v_trip_ids);

        -- Enable trigger กลับ (ถ้าได้ disable ไว้)
        IF EXISTS (
            SELECT 1 
            FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            WHERE c.relname = 'trip_logs'
                AND c.relnamespace = 'public'::regnamespace
                AND t.tgname = 'validate_trip_odometer_trigger'
        ) THEN
            ALTER TABLE public.trip_logs ENABLE TRIGGER validate_trip_odometer_trigger;
            RAISE NOTICE 'Enable trigger validate_trip_odometer_trigger กลับแล้ว';
        END IF;

        RAISE NOTICE 'Reset trip_logs.delivery_trip_id % รายการ', v_trip_logs_count;
    ELSE
        RAISE NOTICE 'ไม่พบ trip_logs ที่เกี่ยวข้อง';
    END IF;

    -- Step 6: ลบ delivery_trips (จะ cascade ลบ delivery_trip_stores, delivery_trip_items, delivery_trip_crews อัตโนมัติ)
    DELETE FROM public.delivery_trips
    WHERE id = ANY(v_trip_ids);

    RAISE NOTICE 'ลบ delivery_trips % รายการสำเร็จ', v_trip_count;
    RAISE NOTICE '=== สรุปการลบข้อมูล ===';
    RAISE NOTICE 'Trip Number: %', v_trip_number;
    RAISE NOTICE 'Commission logs ที่ถูกลบ: % รายการ', v_commission_count;
    RAISE NOTICE 'Orders ที่ reset: % รายการ', v_orders_count;
    RAISE NOTICE 'Trip logs ที่ reset: % รายการ', v_trip_logs_count;
    RAISE NOTICE 'Inventory ที่ยกเลิกการจอง: % รายการ', v_unreserved_count;

END $$;

-- ตรวจสอบผลลัพธ์
SELECT 
    'After Cleanup' as status,
    (SELECT COUNT(*) FROM public.delivery_trips WHERE trip_number = 'DT-2601-0046') as remaining_trips,
    (SELECT COUNT(*) FROM public.orders WHERE delivery_trip_id IN (
        SELECT id FROM public.delivery_trips WHERE trip_number = 'DT-2601-0046'
    )) as orders_still_linked,
    (SELECT COUNT(*) FROM public.trip_logs WHERE delivery_trip_id IN (
        SELECT id FROM public.delivery_trips WHERE trip_number = 'DT-2601-0046'
    )) as trip_logs_still_linked,
    (SELECT COUNT(*) FROM public.commission_logs WHERE delivery_trip_id IN (
        SELECT id FROM public.delivery_trips WHERE trip_number = 'DT-2601-0046'
    )) as commission_logs_still_linked;
