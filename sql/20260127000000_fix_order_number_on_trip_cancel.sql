-- ========================================
-- Fix Order Number Generation When Trip is Cancelled
-- Migration: 20260127000000_fix_order_number_on_trip_cancel.sql
-- ========================================
-- ปัญหา: เมื่อยกเลิกทริป order_number ยังคงอยู่ ทำให้เมื่อสร้างทริปใหม่
--        และ warehouse_id เปลี่ยน (เช่น SD → HQ) order_number เก่าจะไม่ตรงกับ warehouse ใหม่
-- ========================================

-- 1. แก้ไข function generate_order_number_for_trip ให้ตรวจสอบว่า
--    order_number เก่าตรงกับ warehouse_id ใหม่หรือไม่ ถ้าไม่ตรงให้สร้างใหม่
CREATE OR REPLACE FUNCTION generate_order_number_for_trip(
  p_order_id UUID,
  p_trip_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_order_record RECORD;
  v_trip_record RECORD;
  v_trip_store_record RECORD;
  v_warehouse_type TEXT;
  v_warehouse_code TEXT;
  v_order_date DATE;
  v_year TEXT;
  v_month TEXT;
  v_day TEXT;
  v_date_prefix TEXT;
  v_last_number INTEGER;
  v_new_number TEXT;
  v_lock_key BIGINT;
  v_prefix TEXT;
  v_sequence_order INTEGER;
  v_existing_prefix TEXT;
  v_existing_date_prefix TEXT;
  v_should_regenerate BOOLEAN := FALSE;
BEGIN
  -- ดึงข้อมูลออเดอร์
  SELECT 
    o.id,
    o.store_id,
    o.order_date,
    o.warehouse_id,
    o.order_number
  INTO v_order_record
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF v_order_record IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- ดึงข้อมูลทริป
  SELECT 
    dt.id,
    dt.planned_date,
    dt.vehicle_id
  INTO v_trip_record
  FROM public.delivery_trips dt
  WHERE dt.id = p_trip_id;

  IF v_trip_record IS NULL THEN
    RAISE EXCEPTION 'Delivery trip not found: %', p_trip_id;
  END IF;

  -- ดึง sequence_order จาก delivery_trip_stores
  SELECT 
    dts.sequence_order
  INTO v_trip_store_record
  FROM public.delivery_trip_stores dts
  WHERE dts.delivery_trip_id = p_trip_id
    AND dts.store_id = v_order_record.store_id
  LIMIT 1;

  IF v_trip_store_record IS NULL THEN
    RAISE EXCEPTION 'Store not found in delivery trip: order_id=%, trip_id=%', p_order_id, p_trip_id;
  END IF;

  v_sequence_order := v_trip_store_record.sequence_order;

  -- ใช้ order_date จากออเดอร์หรือ planned_date จากทริป
  IF v_order_record.order_date IS NOT NULL THEN
    v_order_date := v_order_record.order_date;
  ELSIF v_trip_record.planned_date IS NOT NULL THEN
    v_order_date := v_trip_record.planned_date;
  ELSE
    v_order_date := CURRENT_DATE;
  END IF;

  -- ตรวจสอบ warehouse type และ code
  IF v_order_record.warehouse_id IS NOT NULL THEN
    SELECT type, code INTO v_warehouse_type, v_warehouse_code
    FROM public.warehouses
    WHERE id = v_order_record.warehouse_id;
  END IF;

  -- กำหนด prefix ตาม warehouse type
  IF v_warehouse_type = 'branch' AND v_order_record.warehouse_id IS NOT NULL THEN
    v_prefix := 'SD';
  ELSE
    v_prefix := 'HQ';
  END IF;

  -- สร้าง date prefix: YYMMDD (ใช้ตรวจสอบก่อน)
  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;

  -- ตรวจสอบว่า order_number เก่าตรงกับ warehouse และวันที่ใหม่หรือไม่
  -- ถ้ามี order_number อยู่แล้ว ให้ตรวจสอบ prefix และ date
  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != '' THEN
    -- ดึง prefix จาก order_number เก่า (2 ตัวแรก: SD หรือ HQ)
    v_existing_prefix := SUBSTRING(v_order_record.order_number FROM 1 FOR 2);
    
    -- ดึง date prefix จาก order_number เก่า (ตัวที่ 3-8: YYMMDD)
    -- รูปแบบ: SD260125001 หรือ HQ260125001
    --         ^^ ^^^^^^
    --         prefix date
    IF LENGTH(v_order_record.order_number) >= 8 THEN
      v_existing_date_prefix := SUBSTRING(v_order_record.order_number FROM 3 FOR 6);
    ELSE
      v_existing_date_prefix := '';
    END IF;
    
    -- ถ้า prefix ไม่ตรงกับ warehouse ใหม่ หรือ date ไม่ตรงกับวันที่ใหม่ ให้สร้างใหม่
    IF v_existing_prefix != v_prefix OR v_existing_date_prefix != v_date_prefix THEN
      v_should_regenerate := TRUE;
    END IF;
  ELSE
    -- ถ้ายังไม่มี order_number ให้สร้างใหม่
    v_should_regenerate := TRUE;
  END IF;

  -- ถ้าไม่ต้องสร้างใหม่ ให้ return order_number เก่า
  IF NOT v_should_regenerate THEN
    RETURN v_order_record.order_number;
  END IF;

  -- Lock based on date to prevent duplicates
  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- กำหนด prefix ตาม warehouse type
  -- สอยดาว (สาขา): SD+YYMMDD+เลขที่บิล (3 หลัก) เช่น SD260125001
  -- สำนักงานใหญ่: HQ+YYMMDD+เลขที่บิล (3 หลัก) เช่น HQ260125001
  IF v_warehouse_type = 'branch' AND v_order_record.warehouse_id IS NOT NULL THEN
    -- สาขา (สอยดาว)
    v_prefix := 'SD';
    
    -- หาเลขที่บิลล่าสุดในวันเดียวกันสำหรับสาขานี้
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(
            order_number 
            FROM v_prefix || v_date_prefix || '([0-9]+)$'
          ) AS INTEGER
        )
      ),
      0
    ) INTO v_last_number
    FROM public.orders
    WHERE order_number ~ ('^' || v_prefix || v_date_prefix || '[0-9]+$')
      AND order_number IS NOT NULL
      AND warehouse_id = v_order_record.warehouse_id
      AND order_date = v_order_date;
    
    -- สร้างเลขใหม่: SD+YYMMDD+เลขที่บิล (3 หลัก)
    -- ใช้ sequence_order เป็น offset จาก last_number
    v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');
    
    -- ตรวจสอบว่าเลขที่สร้างไม่ซ้ำ (เผื่อมีออเดอร์อื่นสร้างไปแล้ว)
    WHILE EXISTS (
      SELECT 1 FROM public.orders 
      WHERE order_number = v_new_number 
        AND id != p_order_id
    ) LOOP
      v_last_number := v_last_number + 1;
      v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');
    END LOOP;
  ELSE
    -- สำนักงานใหญ่ (main) หรือไม่มี warehouse
    v_prefix := 'HQ';
    
    -- หาเลขที่บิลล่าสุดในวันเดียวกันสำหรับสำนักงานใหญ่
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(
            order_number 
            FROM v_prefix || v_date_prefix || '([0-9]+)$'
          ) AS INTEGER
        )
      ),
      0
    ) INTO v_last_number
    FROM public.orders
    WHERE order_number ~ ('^' || v_prefix || v_date_prefix || '[0-9]+$')
      AND order_number IS NOT NULL
      AND (
        warehouse_id IS NULL 
        OR warehouse_id NOT IN (SELECT id FROM public.warehouses WHERE type = 'branch')
        OR warehouse_id IN (SELECT id FROM public.warehouses WHERE type = 'main')
      )
      AND order_date = v_order_date;
    
    -- สร้างเลขใหม่: HQ+YYMMDD+เลขที่บิล (3 หลัก)
    -- ใช้ sequence_order เป็น offset จาก last_number
    v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');
    
    -- ตรวจสอบว่าเลขที่สร้างไม่ซ้ำ (เผื่อมีออเดอร์อื่นสร้างไปแล้ว)
    WHILE EXISTS (
      SELECT 1 FROM public.orders 
      WHERE order_number = v_new_number 
        AND id != p_order_id
    ) LOOP
      v_last_number := v_last_number + 1;
      v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');
    END LOOP;
  END IF;

  RETURN v_new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. แก้ไข trigger ให้ทำงานเมื่อเปลี่ยนทริป (ไม่ใช่แค่จาก NULL เป็นมีค่า)
--    และตรวจสอบว่า warehouse_id เปลี่ยนหรือไม่
CREATE OR REPLACE FUNCTION trigger_generate_order_number_on_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_trip_id UUID;
  v_new_number TEXT;
  v_old_warehouse_id UUID;
  v_new_warehouse_id UUID;
  v_should_regenerate BOOLEAN := FALSE;
BEGIN
  -- ตรวจสอบว่า delivery_trip_id เปลี่ยน (จาก NULL เป็นมีค่า หรือเปลี่ยนทริป)
  IF (OLD.delivery_trip_id IS NULL AND NEW.delivery_trip_id IS NOT NULL) 
     OR (OLD.delivery_trip_id IS DISTINCT FROM NEW.delivery_trip_id AND NEW.delivery_trip_id IS NOT NULL) THEN
    v_order_id := NEW.id;
    v_trip_id := NEW.delivery_trip_id;
    
    -- ตรวจสอบว่า warehouse_id เปลี่ยนหรือไม่
    v_old_warehouse_id := OLD.warehouse_id;
    v_new_warehouse_id := NEW.warehouse_id;
    
    -- ถ้า warehouse_id เปลี่ยน ให้สร้าง order_number ใหม่
    IF v_old_warehouse_id IS DISTINCT FROM v_new_warehouse_id THEN
      v_should_regenerate := TRUE;
    END IF;
    
    -- ถ้ายังไม่มี order_number ให้สร้างใหม่
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
      v_should_regenerate := TRUE;
    END IF;
    
    -- ถ้าต้องสร้างใหม่ ให้เรียก function
    IF v_should_regenerate THEN
      v_new_number := generate_order_number_for_trip(v_order_id, v_trip_id);
      NEW.order_number := v_new_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- สร้าง trigger ใหม่
DROP TRIGGER IF EXISTS trigger_generate_order_number_on_trip_assignment ON public.orders;

CREATE TRIGGER trigger_generate_order_number_on_trip_assignment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.delivery_trip_id IS DISTINCT FROM NEW.delivery_trip_id
    AND NEW.delivery_trip_id IS NOT NULL
  )
  EXECUTE FUNCTION trigger_generate_order_number_on_trip_assignment();

-- 3. Comments
COMMENT ON FUNCTION generate_order_number_for_trip IS 
  'สร้าง order_number สำหรับออเดอร์ที่ถูก assign ไปยังทริปแล้ว โดยใช้ลำดับจาก delivery_trip_stores.sequence_order. รูปแบบ: SD (สอยดาว) หรือ HQ (สำนักงานใหญ่) + YYMMDD + เลขที่บิล (3 หลัก). ถ้า order_number เก่าไม่ตรงกับ warehouse_id ใหม่จะสร้างใหม่';

COMMENT ON FUNCTION trigger_generate_order_number_on_trip_assignment IS 
  'Trigger ที่สร้าง order_number อัตโนมัติเมื่อออเดอร์ถูก assign ไปยังทริป หรือเมื่อเปลี่ยนทริป/warehouse_id';

-- ========================================
-- หมายเหตุ
-- ========================================
-- 1. เมื่อยกเลิกทริป (cancel) deliveryTripService.cancel() จะ reset delivery_trip_id และ order_number เป็น NULL
-- 2. เมื่อลบทริป (delete) deliveryTripService.delete() จะ reset delivery_trip_id และ order_number เป็น NULL
-- 3. เมื่อสร้างทริปใหม่และ assign ออเดอร์ไปยังทริปใหม่ trigger จะสร้าง order_number ใหม่
-- 4. ถ้า warehouse_id เปลี่ยน (เช่น SD → HQ) order_number จะถูกสร้างใหม่ให้ตรงกับ warehouse ใหม่
-- 5. Function จะตรวจสอบว่า order_number เก่าตรงกับ warehouse_id ใหม่หรือไม่ ถ้าไม่ตรงจะสร้างใหม่
-- 6. เมื่อเปลี่ยนวันส่ง (order_date) หรือเปลี่ยนทริป order_number จะถูกสร้างใหม่ตามวันที่และ warehouse ใหม่
-- ========================================
