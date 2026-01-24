-- ========================================
-- แก้ไข Logic การสร้างเลขที่บิล (Order Number)
-- Fix: Cannot generate unique order_number after 1000 attempts
-- ========================================
-- ปัญหา: Function พยายามใช้เลขจากวันอื่นมาคำนวณ ทำให้เกิด conflict
-- แก้ไข: หาเลขล่าสุดของวันนั้นๆ เท่านั้น และเพิ่มทีละ 1
-- ========================================

CREATE OR REPLACE FUNCTION public.generate_order_number_for_trip(
  p_order_id UUID,
  p_trip_id UUID
)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_record RECORD;
  v_trip_record RECORD;
  v_trip_store_record RECORD;
  v_warehouse_type TEXT;
  v_order_date DATE;
  v_prefix TEXT;
  v_date_prefix TEXT;
  v_last_number INTEGER;
  v_new_number TEXT;
  v_sequence_order INTEGER;
  v_lock_key BIGINT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 100; -- ลดลงเพราะไม่ควรใช้เวลานาน
BEGIN
  -- 1. ดึงข้อมูล order
  SELECT o.id, o.store_id, o.order_date, o.warehouse_id, o.order_number
  INTO v_order_record 
  FROM public.orders o 
  WHERE o.id = p_order_id;
  
  IF v_order_record IS NULL THEN 
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- ถ้ามี order_number แล้ว ให้ return ทันที
  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != '' THEN 
    RETURN v_order_record.order_number;
  END IF;
  
  -- 2. ดึงข้อมูล trip
  SELECT dt.planned_date 
  INTO v_trip_record 
  FROM public.delivery_trips dt 
  WHERE dt.id = p_trip_id;
  
  IF v_trip_record IS NULL THEN 
    RAISE EXCEPTION 'Trip not found: %', p_trip_id;
  END IF;
  
  -- 3. ดึง sequence_order จาก delivery_trip_stores
  SELECT dts.sequence_order 
  INTO v_trip_store_record
  FROM public.delivery_trip_stores dts
  WHERE dts.delivery_trip_id = p_trip_id 
    AND dts.store_id = v_order_record.store_id 
  LIMIT 1;
  
  IF v_trip_store_record IS NULL THEN 
    RAISE EXCEPTION 'Store not in trip: order_id=%, trip_id=%', p_order_id, p_trip_id;
  END IF;
  
  v_sequence_order := v_trip_store_record.sequence_order;
  
  -- 4. กำหนดวันที่ที่จะใช้สร้างเลขบิล
  v_order_date := COALESCE(
    v_order_record.order_date, 
    v_trip_record.planned_date, 
    CURRENT_DATE
  );
  
  -- 5. กำหนด warehouse type และ prefix
  IF v_order_record.warehouse_id IS NOT NULL THEN
    SELECT type 
    INTO v_warehouse_type 
    FROM public.warehouses 
    WHERE id = v_order_record.warehouse_id;
  END IF;
  
  v_prefix := CASE 
    WHEN v_warehouse_type = 'branch' THEN 'SD' 
    ELSE 'HQ' 
  END;
  
  -- 6. สร้าง date prefix (YYMMDD)
  v_date_prefix := TO_CHAR(v_order_date, 'YYMMDD');
  
  -- 7. Lock เพื่อป้องกัน concurrent access
  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- 8. หาเลขล่าสุดของวันนั้นๆ และ prefix นั้นๆ เท่านั้น
  -- ⚠️ สำคัญ: ต้องหาจากวันเดียวกันเท่านั้น ไม่ใช่จาก trip
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(order_number FROM (LENGTH(v_prefix || v_date_prefix) + 1)::INTEGER)
        AS INTEGER
      )
    ),
    0
  )
  INTO v_last_number
  FROM public.orders
  WHERE order_number IS NOT NULL
    AND order_number LIKE (v_prefix || v_date_prefix || '%')
    AND LENGTH(order_number) = LENGTH(v_prefix || v_date_prefix) + 3;
  
  -- 9. สร้างเลขใหม่โดยเพิ่มจากเลขล่าสุด + 1
  -- ⚠️ ไม่ใช้ sequence_order ในการคำนวณเลขบิล
  -- sequence_order ใช้แค่เพื่อเรียงลำดับร้านค้าในทริปเท่านั้น
  v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + 1)::TEXT, 3, '0');
  
  -- 10. ตรวจสอบว่าเลขที่สร้างไม่ซ้ำ
  WHILE EXISTS (
    SELECT 1 
    FROM public.orders 
    WHERE order_number = v_new_number 
      AND id != p_order_id
  ) LOOP
    v_last_number := v_last_number + 1;
    v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + 1)::TEXT, 3, '0');
    v_attempts := v_attempts + 1;
    
    IF v_attempts > v_max_attempts THEN
      RAISE EXCEPTION 'Cannot generate unique order_number after % attempts. Prefix: %, Date: %, Last: %, New: %', 
        v_max_attempts, v_prefix, v_date_prefix, v_last_number, v_new_number;
    END IF;
  END LOOP;
  
  RETURN v_new_number;
END;
$$;

-- ========================================
-- ตรวจสอบผลลัพธ์
-- ========================================

DO $$
DECLARE
  fn_exists BOOLEAN;
BEGIN
  -- ตรวจสอบว่า function มีอยู่และมี signature ที่ถูกต้อง
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname = 'generate_order_number_for_trip'
      AND pg_get_function_arguments(p.oid) = 'p_order_id uuid, p_trip_id uuid'
  ) INTO fn_exists;
  
  IF fn_exists THEN
    RAISE NOTICE '✅ Function generate_order_number_for_trip updated successfully';
  ELSE
    RAISE WARNING '❌ Function generate_order_number_for_trip not found';
  END IF;
END $$;

-- ========================================
-- ทดสอบ Function (Comment ออกถ้าไม่ต้องการทดสอบ)
-- ========================================

/*
-- ตัวอย่างการทดสอบ:
SELECT 
  id,
  order_number,
  order_date,
  delivery_trip_id,
  warehouse_id
FROM orders
WHERE order_date >= '2026-01-23'
ORDER BY order_date DESC, order_number DESC
LIMIT 20;
*/

-- ========================================
-- หมายเหตุ
-- ========================================
-- 
-- การเปลี่ยนแปลง:
-- 1. ❌ เอา sequence_order ออกจากการคำนวณเลขบิล
-- 2. ✅ หาเลขล่าสุดจากวันนั้นๆ เท่านั้น (ไม่ใช่จาก trip)
-- 3. ✅ เพิ่มเลขทีละ 1 จากเลขล่าสุด
-- 4. ✅ ใช้ SUBSTRING แทน regex เพื่อความแม่นยำ
-- 5. ✅ ลด max_attempts เป็น 100 (จาก 1000)
--
-- ตัวอย่างผลลัพธ์:
-- - วันที่ 23 ม.ค.: HQ260123001, HQ260123002, HQ260123003, ...
-- - วันที่ 24 ม.ค.: HQ260124001, HQ260124002, HQ260124003, ...
-- - สาขา A วันที่ 23 ม.ค.: SD260123001, SD260123002, ...
-- - สาขา A วันที่ 24 ม.ค.: SD260124001, SD260124002, ...
--
