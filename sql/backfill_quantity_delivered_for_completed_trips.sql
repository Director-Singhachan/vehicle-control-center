-- ============================================================
-- Backfill: ซิงค์ quantity_delivered สำหรับทริปที่ completed แล้ว
-- ============================================================
-- ใช้สำหรับซิงค์ข้อมูลย้อนหลังสำหรับทริปที่ completed ก่อนที่จะมี trigger
-- หรือกรณีที่ trigger ไม่ทำงาน
-- ============================================================

-- 1. ตรวจสอบสถานะปัจจุบันของออเดอร์และทริปที่ระบุ
-- ============================================================
-- รันส่วนนี้ก่อนเพื่อดูสถานะปัจจุบัน
-- ============================================================

-- ตรวจสอบออเดอร์ SD260220010
SELECT 
    o.id AS order_id,
    o.order_number,
    o.status AS order_status,
    o.store_id,
    o.delivery_trip_id,
    o.created_at AS order_created_at
FROM public.orders o
WHERE o.order_number = 'SD260220010';

-- ตรวจสอบทริป SD-2602-0072
SELECT 
    dt.id AS trip_id,
    dt.trip_number,
    dt.status AS trip_status,
    dt.created_at AS trip_created_at,
    dt.updated_at AS trip_updated_at
FROM public.delivery_trips dt
WHERE dt.trip_number = 'SD-2602-0072';

-- ตรวจสอบ order_items ของออเดอร์ SD260220010
SELECT 
    oi.id AS item_id,
    oi.order_id,
    oi.product_id,
    oi.quantity AS ordered_qty,
    oi.quantity_picked_up_at_store,
    oi.quantity_delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining,
    p.product_code,
    p.product_name
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.order_number = 'SD260220010'
ORDER BY oi.created_at;

-- ตรวจสอบ delivery_trip_items ของทริป SD-2602-0072
SELECT 
    dti.id AS trip_item_id,
    dti.delivery_trip_store_id,
    dti.product_id,
    dti.quantity AS trip_item_qty,
    dts.store_id,
    p.product_code,
    p.product_name
FROM public.delivery_trip_items dti
JOIN public.delivery_trip_stores dts ON dts.id = dti.delivery_trip_store_id
JOIN public.delivery_trips dt ON dt.id = dts.delivery_trip_id
LEFT JOIN public.products p ON p.id = dti.product_id
WHERE dt.trip_number = 'SD-2602-0072'
ORDER BY dti.created_at;

-- ============================================================
-- 2. Function: ซิงค์ quantity_delivered สำหรับทริปที่ระบุ
-- ============================================================
CREATE OR REPLACE FUNCTION public.backfill_quantity_delivered_for_trip(
    p_trip_id uuid
)
RETURNS TABLE(
    order_id uuid,
    order_number text,
    item_id uuid,
    product_code text,
    product_name text,
    ordered_qty numeric,
    old_delivered numeric,
    new_delivered numeric,
    updated boolean
)
LANGUAGE plpgsql AS $$
DECLARE
    v_store        RECORD;
    v_order        RECORD;
    v_order_item   RECORD;
    v_trip_item    RECORD;
    v_total_delivered numeric;
    v_old_delivered numeric;
BEGIN
    -- ตรวจสอบว่าทริปนี้เป็น completed หรือไม่
    IF NOT EXISTS (
        SELECT 1 FROM public.delivery_trips dt 
        WHERE dt.id = p_trip_id AND dt.status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Trip % is not completed', p_trip_id;
    END IF;

    -- วนผ่านทุก store ในทริปนี้
    FOR v_store IN
        SELECT dts.id AS trip_store_id, dts.store_id
        FROM public.delivery_trip_stores dts
        WHERE dts.delivery_trip_id = p_trip_id
    LOOP
        -- วนผ่านทุก item ที่ส่งให้ร้านนี้ในทริปนี้
        FOR v_trip_item IN
            SELECT dti.product_id, dti.quantity
            FROM public.delivery_trip_items dti
            WHERE dti.delivery_trip_store_id = v_store.trip_store_id
        LOOP
            -- หา orders ที่ตรงกับร้านนี้ (status = confirmed, partial, หรือ assigned)
            -- และมี order_item ที่ตรง product_id นี้
            FOR v_order IN
                SELECT DISTINCT o.id AS order_id, o.order_number, o.created_at
                FROM public.orders o
                JOIN public.order_items oi ON oi.order_id = o.id
                WHERE o.store_id = v_store.store_id
                    AND o.status IN ('confirmed', 'partial', 'assigned')
                    AND oi.product_id = v_trip_item.product_id
                ORDER BY o.created_at ASC
                LIMIT 1  -- เลือกออเดอร์เก่าสุดที่ยังค้างส่ง (FIFO)
            LOOP
                -- หา order_item ที่ตรงกัน
                FOR v_order_item IN
                    SELECT oi.id, oi.quantity, oi.quantity_picked_up_at_store, oi.quantity_delivered
                    FROM public.order_items oi
                    WHERE oi.order_id = v_order.order_id
                        AND oi.product_id = v_trip_item.product_id
                LOOP
                    -- เก็บค่าเดิม
                    v_old_delivered := COALESCE(v_order_item.quantity_delivered, 0);

                    -- คำนวณ quantity_delivered รวมจากทุก completed trips
                    -- ที่เคยส่งสินค้านี้ให้ร้านนี้
                    SELECT COALESCE(SUM(dti2.quantity), 0) INTO v_total_delivered
                    FROM public.delivery_trip_items dti2
                    JOIN public.delivery_trip_stores dts2 ON dts2.id = dti2.delivery_trip_store_id
                    JOIN public.delivery_trips dt2 ON dt2.id = dts2.delivery_trip_id
                    WHERE dt2.status = 'completed'
                        AND dts2.store_id = v_store.store_id
                        AND dti2.product_id = v_trip_item.product_id;

                    -- อัปเดต quantity_delivered (ไม่เกิน quantity ที่สั่ง)
                    UPDATE public.order_items
                    SET
                        quantity_delivered = LEAST(v_total_delivered, v_order_item.quantity),
                        updated_at = NOW()
                    WHERE id = v_order_item.id;

                    -- Return result (join products เพื่อเลี่ยงชื่อ column ซ้ำกับตัวแปร OUT)
                    RETURN QUERY
                    SELECT 
                        v_order.order_id,
                        v_order.order_number,
                        v_order_item.id,
                        p.product_code,
                        p.product_name,
                        v_order_item.quantity::numeric,  -- Cast เป็น numeric เพื่อให้ตรงกับ function signature
                        v_old_delivered,
                        LEAST(v_total_delivered, v_order_item.quantity),
                        (LEAST(v_total_delivered, v_order_item.quantity) <> v_old_delivered)::boolean
                    FROM public.products p
                    WHERE p.id = v_trip_item.product_id;
                END LOOP; -- order_item
            END LOOP; -- order
        END LOOP; -- trip_item
    END LOOP; -- store

    -- อัปเดต status ของ orders ที่เกี่ยวข้องกับทริปนี้
    FOR v_order IN
        SELECT DISTINCT o.id AS order_id
        FROM public.orders o
        JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id
        WHERE dts.delivery_trip_id = p_trip_id
            AND o.status NOT IN ('cancelled', 'delivered')
    LOOP
        -- คำนวณว่าส่งครบหรือยัง
        DECLARE
            v_total_qty numeric;
            v_total_fulfilled numeric;
            v_new_order_status text;
            v_current_order_id uuid;  -- เก็บ order_id ในตัวแปร local เพื่อเลี่ยง ambiguous
        BEGIN
            v_current_order_id := v_order.order_id;  -- เก็บค่าไว้ในตัวแปร local
            
            SELECT
                COALESCE(SUM(oi.quantity), 0),
                COALESCE(SUM(oi.quantity_picked_up_at_store + oi.quantity_delivered), 0)
            INTO v_total_qty, v_total_fulfilled
            FROM public.order_items oi
            WHERE oi.order_id = v_current_order_id;  -- ใช้ตัวแปร local แทน

            IF v_total_qty > 0 AND v_total_fulfilled >= v_total_qty THEN
                v_new_order_status := 'delivered';
            ELSIF v_total_fulfilled > 0 THEN
                v_new_order_status := 'partial';
            ELSE
                v_new_order_status := NULL;
            END IF;

            IF v_new_order_status IS NOT NULL THEN
                UPDATE public.orders
                SET status = v_new_order_status, updated_at = NOW()
                WHERE id = v_current_order_id;  -- ใช้ตัวแปร local แทน
            END IF;
        END;
    END LOOP;
END;
$$;

-- ============================================================
-- 3. ซิงค์ข้อมูลสำหรับทริป SD-2602-0072
-- ============================================================
-- รันส่วนนี้เพื่อซิงค์ข้อมูลสำหรับทริปที่ระบุ
-- ============================================================

-- หา trip_id จาก trip_number
DO $$
DECLARE
    v_trip_id uuid;
    v_result RECORD;
BEGIN
    -- หา trip_id
    SELECT id INTO v_trip_id
    FROM public.delivery_trips
    WHERE trip_number = 'SD-2602-0072';

    IF v_trip_id IS NULL THEN
        RAISE NOTICE 'ไม่พบทริป SD-2602-0072';
    ELSE
        RAISE NOTICE 'พบทริป SD-2602-0072: %', v_trip_id;
        
        -- ซิงค์ข้อมูล
        FOR v_result IN
            SELECT * FROM public.backfill_quantity_delivered_for_trip(v_trip_id)
        LOOP
            RAISE NOTICE 'อัปเดต: ออเดอร์ % | สินค้า % | เดิม: % | ใหม่: % | อัปเดต: %',
                v_result.order_number,
                v_result.product_name,
                v_result.old_delivered,
                v_result.new_delivered,
                CASE WHEN v_result.updated THEN 'ใช่' ELSE 'ไม่' END;
        END LOOP;
    END IF;
END $$;

-- ============================================================
-- 4. ซิงค์ข้อมูลสำหรับทริปที่ completed ทั้งหมด (ถ้าต้องการ)
-- ============================================================
-- ระวัง: อาจใช้เวลานานถ้ามีทริปเยอะ
-- ============================================================
/*
DO $$
DECLARE
    v_trip RECORD;
    v_count integer := 0;
BEGIN
    FOR v_trip IN
        SELECT id, trip_number
        FROM public.delivery_trips
        WHERE status = 'completed'
        ORDER BY created_at ASC
    LOOP
        BEGIN
            PERFORM public.backfill_quantity_delivered_for_trip(v_trip.id);
            v_count := v_count + 1;
            RAISE NOTICE '[%/%] ซิงค์ทริป % สำเร็จ', v_count, (SELECT COUNT(*) FROM public.delivery_trips WHERE status = 'completed'), v_trip.trip_number;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'เกิดข้อผิดพลาดเมื่อซิงค์ทริป %: %', v_trip.trip_number, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'ซิงค์เสร็จสิ้น: % ทริป', v_count;
END $$;
*/

-- ============================================================
-- 5. ตรวจสอบผลลัพธ์หลังซิงค์
-- ============================================================
-- รันส่วนนี้หลังซิงค์เพื่อยืนยันว่าข้อมูลถูกต้อง
-- ============================================================

-- ตรวจสอบ order_items ของออเดอร์ SD260220010 อีกครั้ง
SELECT 
    oi.id AS item_id,
    oi.order_id,
    oi.product_id,
    oi.quantity AS ordered_qty,
    oi.quantity_picked_up_at_store,
    oi.quantity_delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining,
    p.product_code,
    p.product_name,
    o.status AS order_status
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.order_number = 'SD260220010'
ORDER BY oi.created_at;

-- ============================================================
-- หมายเหตุ:
-- ============================================================
-- 1. รันส่วนที่ 1 ก่อนเพื่อดูสถานะปัจจุบัน
-- 2. รันส่วนที่ 3 เพื่อซิงค์ข้อมูลสำหรับทริป SD-2602-0072
-- 3. รันส่วนที่ 5 เพื่อยืนยันผลลัพธ์
-- 4. ถ้าต้องการซิงค์ทริปทั้งหมด ให้ uncomment ส่วนที่ 4
-- ============================================================
