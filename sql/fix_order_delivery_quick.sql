-- ============================================================
-- Quick Fix: แก้ไข quantity_delivered สำหรับออเดอร์ที่ส่งแล้วแต่ยังไม่แสดง
-- ============================================================
-- ใช้สำหรับออเดอร์ที่ส่งไปแล้วแต่ "ส่งแล้ว" ยังไม่ขึ้นใน UI
-- ============================================================

-- วิธีใช้:
-- 1. เปลี่ยน 'SD260220010' เป็น order_number ที่ต้องการแก้ไข
-- 2. รัน script นี้
-- 3. ตรวจสอบผลลัพธ์ในส่วนท้าย

-- ============================================================
-- ตั้งค่า: เปลี่ยน order_number ตรงนี้
-- ============================================================
DO $$
DECLARE
    v_order_number text := 'SD260220010';  -- ⬅️ เปลี่ยนตรงนี้
    v_order_id uuid;
    v_store_id uuid;
    v_trip_id uuid;
    v_trip_number text;
    v_updated_count int := 0;
    v_order_item RECORD;
    v_total_delivered numeric;
BEGIN
    -- หา order_id และ store_id
    SELECT id, store_id INTO v_order_id, v_store_id
    FROM public.orders
    WHERE order_number = v_order_number;
    
    IF v_order_id IS NULL THEN
        RAISE EXCEPTION 'ไม่พบออเดอร์: %', v_order_number;
    END IF;
    
    RAISE NOTICE '🔍 กำลังตรวจสอบออเดอร์: % (ID: %)', v_order_number, v_order_id;
    
    -- หาทริปที่ completed ที่ส่งให้ร้านนี้
    SELECT DISTINCT dt.id, dt.trip_number
    INTO v_trip_id, v_trip_number
    FROM public.delivery_trips dt
    JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = dt.id
    WHERE dts.store_id = v_store_id
      AND dt.status = 'completed'
    ORDER BY dt.created_at DESC
    LIMIT 1;
    
    IF v_trip_id IS NULL THEN
        RAISE NOTICE '⚠️ ไม่พบทริปที่ completed ที่ส่งให้ร้านนี้';
        RAISE NOTICE '   ตรวจสอบว่าทริปที่ส่งออเดอร์นี้ completed แล้วหรือยัง';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ พบทริป: % (ID: %)', v_trip_number, v_trip_id;
    RAISE NOTICE '📦 กำลังอัปเดต quantity_delivered...';
    
    -- วนผ่านทุก order_item ของออเดอร์นี้
    FOR v_order_item IN
        SELECT oi.id, oi.product_id, oi.quantity, oi.quantity_delivered
        FROM public.order_items oi
        WHERE oi.order_id = v_order_id
    LOOP
        -- คำนวณ quantity_delivered รวมจากทุก completed trips ที่ส่งสินค้านี้ให้ร้านนี้
        SELECT COALESCE(SUM(dti.quantity), 0) INTO v_total_delivered
        FROM public.delivery_trip_items dti
        JOIN public.delivery_trip_stores dts ON dts.id = dti.delivery_trip_store_id
        JOIN public.delivery_trips dt ON dt.id = dts.delivery_trip_id
        WHERE dt.status = 'completed'
          AND dts.store_id = v_store_id
          AND dti.product_id = v_order_item.product_id;
        
        -- อัปเดต quantity_delivered (ไม่เกิน quantity ที่สั่ง)
        IF COALESCE(v_order_item.quantity_delivered, 0) <> LEAST(v_total_delivered, v_order_item.quantity) THEN
            UPDATE public.order_items
            SET 
                quantity_delivered = LEAST(v_total_delivered, v_order_item.quantity),
                updated_at = NOW()
            WHERE id = v_order_item.id;
            
            v_updated_count := v_updated_count + 1;
            
            RAISE NOTICE '   ✅ อัปเดต item (product_id: %): % → %', 
                v_order_item.product_id,
                COALESCE(v_order_item.quantity_delivered, 0),
                LEAST(v_total_delivered, v_order_item.quantity);
        END IF;
    END LOOP;
    
    -- อัปเดต order status
    DECLARE
        v_total_qty numeric;
        v_total_fulfilled numeric;
        v_new_status text;
    BEGIN
        SELECT 
            COALESCE(SUM(quantity), 0),
            COALESCE(SUM(quantity_picked_up_at_store + quantity_delivered), 0)
        INTO v_total_qty, v_total_fulfilled
        FROM public.order_items
        WHERE order_id = v_order_id;
        
        IF v_total_qty > 0 AND v_total_fulfilled >= v_total_qty THEN
            v_new_status := 'delivered';
        ELSIF v_total_fulfilled > 0 THEN
            v_new_status := 'partial';
        ELSE
            v_new_status := NULL;
        END IF;
        
        IF v_new_status IS NOT NULL THEN
            UPDATE public.orders
            SET status = v_new_status, updated_at = NOW()
            WHERE id = v_order_id;
            
            RAISE NOTICE '✅ อัปเดต order status: %', v_new_status;
        END IF;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ เสร็จสิ้น! อัปเดต % items', v_updated_count;
    RAISE NOTICE '   ตรวจสอบผลลัพธ์ด้านล่าง';
    
END $$;

-- ============================================================
-- แสดงผลลัพธ์: order_items หลังอัปเดต
-- ============================================================
SELECT 
    o.order_number,
    o.status AS order_status,
    p.product_code,
    p.product_name,
    oi.quantity AS ordered_qty,
    COALESCE(oi.quantity_picked_up_at_store, 0) AS picked_up,
    COALESCE(oi.quantity_delivered, 0) AS delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.order_number = 'SD260220010'  -- ⬅️ เปลี่ยนตรงนี้ให้ตรงกับด้านบน
ORDER BY oi.created_at;
