-- ========================================
-- Defer Order Number Generation Until Trip Assignment
-- Migration: 20260206000000_defer_order_number_generation.sql
-- ========================================
-- เปลี่ยน workflow: order_number จะถูกสร้างหลังจากฝ่ายจัดทริปจัดลำดับร้านค้าแล้ว
-- ไม่ใช่ตอนสร้างออเดอร์
-- ========================================

-- 1. ปิด trigger ที่สร้าง order_number อัตโนมัติตอน INSERT
DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.orders;

-- 2. สร้าง function ใหม่สำหรับสร้าง order_number ตามลำดับในทริป
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

  -- ถ้ามี order_number อยู่แล้ว ไม่ต้องสร้างใหม่
  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != '' THEN
    RETURN v_order_record.order_number;
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

  -- สร้าง date prefix: YYMMDD
  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;

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
    -- เช่น sequence_order = 1 → ใช้ last_number + 1
    --     sequence_order = 2 → ใช้ last_number + 2
    -- แต่ต้องตรวจสอบว่าไม่ซ้ำกับที่มีอยู่แล้ว
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

-- 3. สร้าง function สำหรับสร้าง order_number ให้กับออเดอร์ทั้งหมดในทริป
CREATE OR REPLACE FUNCTION generate_order_numbers_for_trip(
  p_trip_id UUID
)
RETURNS TABLE(order_id UUID, order_number TEXT) AS $$
DECLARE
  v_order_record RECORD;
  v_new_number TEXT;
BEGIN
  -- Loop ผ่านออเดอร์ทั้งหมดในทริป ตามลำดับ sequence_order
  FOR v_order_record IN
    SELECT 
      o.id,
      o.store_id,
      o.order_number
    FROM public.orders o
    INNER JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id
    WHERE o.delivery_trip_id = p_trip_id
      AND dts.delivery_trip_id = p_trip_id
    ORDER BY dts.sequence_order ASC
  LOOP
    -- ถ้ายังไม่มี order_number ให้สร้างใหม่
    IF v_order_record.order_number IS NULL OR v_order_record.order_number = '' THEN
      v_new_number := generate_order_number_for_trip(v_order_record.id, p_trip_id);
      
      -- อัพเดท order_number
      UPDATE public.orders
      SET order_number = v_new_number
      WHERE id = v_order_record.id;
      
      -- Return result
      order_id := v_order_record.id;
      order_number := v_new_number;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. สร้าง trigger สำหรับสร้าง order_number อัตโนมัติเมื่อ assign orders to trip
CREATE OR REPLACE FUNCTION trigger_generate_order_number_on_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_trip_id UUID;
  v_new_number TEXT;
BEGIN
  -- ตรวจสอบว่า delivery_trip_id เปลี่ยนจาก NULL เป็นมีค่า (assign to trip)
  IF OLD.delivery_trip_id IS NULL AND NEW.delivery_trip_id IS NOT NULL THEN
    v_order_id := NEW.id;
    v_trip_id := NEW.delivery_trip_id;
    
    -- ถ้ายังไม่มี order_number ให้สร้างใหม่
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
      v_new_number := generate_order_number_for_trip(v_order_id, v_trip_id);
      NEW.order_number := v_new_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- สร้าง trigger
DROP TRIGGER IF EXISTS trigger_generate_order_number_on_trip_assignment ON public.orders;

CREATE TRIGGER trigger_generate_order_number_on_trip_assignment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.delivery_trip_id IS DISTINCT FROM NEW.delivery_trip_id
    AND NEW.delivery_trip_id IS NOT NULL
    AND (NEW.order_number IS NULL OR NEW.order_number = '')
  )
  EXECUTE FUNCTION trigger_generate_order_number_on_trip_assignment();

-- 5. Comments
COMMENT ON FUNCTION generate_order_number_for_trip IS 
  'สร้าง order_number สำหรับออเดอร์ที่ถูก assign ไปยังทริปแล้ว โดยใช้ลำดับจาก delivery_trip_stores.sequence_order. รูปแบบ: SD (สอยดาว) หรือ HQ (สำนักงานใหญ่) + YYMMDD + เลขที่บิล (3 หลัก)';

COMMENT ON FUNCTION generate_order_numbers_for_trip IS 
  'สร้าง order_number ให้กับออเดอร์ทั้งหมดในทริป ตามลำดับ sequence_order';

COMMENT ON FUNCTION trigger_generate_order_number_on_trip_assignment IS 
  'Trigger ที่สร้าง order_number อัตโนมัติเมื่อออเดอร์ถูก assign ไปยังทริป';

-- ========================================
-- หมายเหตุ
-- ========================================
-- 1. ออเดอร์ที่สร้างใหม่จะยังไม่มี order_number จนกว่าจะถูก assign ไปยังทริป
-- 2. order_number จะถูกสร้างตามลำดับ sequence_order ใน delivery_trip_stores
-- 3. รูปแบบ order_number ใหม่:
--    - สอยดาว (สาขา): SD+YYMMDD+เลขที่บิล (3 หลัก) เช่น SD260125001
--    - สำนักงานใหญ่: HQ+YYMMDD+เลขที่บิล (3 หลัก) เช่น HQ260125001
-- 4. เลขที่บิลจะเรียงตามลำดับการส่งในทริป (sequence_order)
-- 5. ยกเลิกการใช้ I0, I1 แล้ว
-- ========================================
