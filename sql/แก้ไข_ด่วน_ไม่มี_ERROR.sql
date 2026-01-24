-- ========================================
-- 🚨 แก้ไขด่วน - ไม่มี ERROR
-- ========================================
-- รัน SQL นี้เพื่อแก้ไขปัญหาโดยไม่มี error
-- ========================================

-- ========================================
-- STEP 0: ลบ Triggers เก่าทั้งหมด
-- ========================================

DROP TRIGGER IF EXISTS trigger_generate_order_number_on_trip_assignment ON public.orders;
DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;

-- ========================================
-- STEP 1: สร้าง Functions
-- ========================================

-- Function 1: generate_order_number_for_trip
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
BEGIN
  SELECT o.id, o.store_id, o.order_date, o.warehouse_id, o.order_number
  INTO v_order_record FROM public.orders o WHERE o.id = p_order_id;
  IF v_order_record IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != '' THEN 
    RETURN v_order_record.order_number;
  END IF;
  SELECT dt.planned_date INTO v_trip_record FROM public.delivery_trips dt WHERE dt.id = p_trip_id;
  IF v_trip_record IS NULL THEN RAISE EXCEPTION 'Trip not found'; END IF;
  SELECT dts.sequence_order INTO v_trip_store_record
  FROM public.delivery_trip_stores dts
  WHERE dts.delivery_trip_id = p_trip_id AND dts.store_id = v_order_record.store_id LIMIT 1;
  IF v_trip_store_record IS NULL THEN RAISE EXCEPTION 'Store not in trip'; END IF;
  v_sequence_order := v_trip_store_record.sequence_order;
  v_order_date := COALESCE(v_order_record.order_date, v_trip_record.planned_date, CURRENT_DATE);
  IF v_order_record.warehouse_id IS NOT NULL THEN
    SELECT type INTO v_warehouse_type FROM public.warehouses WHERE id = v_order_record.warehouse_id;
  END IF;
  -- สร้าง date prefix จาก v_order_date ที่ใช้สร้าง new number
  v_date_prefix := TO_CHAR(v_order_date, 'YYMMDD');
  v_prefix := CASE WHEN v_warehouse_type = 'branch' THEN 'SD' ELSE 'HQ' END;
  
  -- Lock based on date to prevent concurrent duplicates
  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- หาเลขล่าสุดในวันเดียวกัน (สำหรับ prefix และ date เดียวกัน)
  -- ต้องใช้ v_date_prefix ที่ตรงกับ v_order_date ที่ใช้สร้าง new number
  -- ใช้ regex pattern ที่ชัดเจน: ^prefix + date_prefix + [0-9]+$
  -- ตัวอย่าง: ^SD260123[0-9]+$ จะหาเลขที่ขึ้นต้นด้วย SD260123
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '\d+$') AS INTEGER)), 0)
  INTO v_last_number 
  FROM public.orders
  WHERE order_number IS NOT NULL
    AND order_number ~ ('^' || v_prefix || v_date_prefix || '[0-9]+$')
    AND LENGTH(order_number) = LENGTH(v_prefix || v_date_prefix) + 3; -- ตรวจสอบความยาว (prefix + date + 3 หลัก)
  
  -- หาเลขล่าสุดของ orders ในทริปเดียวกันที่มี order_number แล้ว
  -- เพื่อให้แน่ใจว่าเลขใหม่จะไม่ซ้ำกับ orders ในทริปเดียวกัน
  -- ใช้ GREATEST เพื่อหาค่าที่มากที่สุด
  -- ต้องใช้ v_date_prefix เดียวกันกับที่ใช้สร้าง new number
  SELECT GREATEST(
    v_last_number,
    COALESCE(MAX(CAST(SUBSTRING(o.order_number FROM '\d+$') AS INTEGER)), 0)
  )
  INTO v_last_number
  FROM public.orders o
  INNER JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id
  WHERE o.delivery_trip_id = p_trip_id
    AND dts.delivery_trip_id = p_trip_id
    AND o.order_number IS NOT NULL
    AND o.order_number ~ ('^' || v_prefix || v_date_prefix || '[0-9]+$')
    AND LENGTH(o.order_number) = LENGTH(v_prefix || v_date_prefix) + 3; -- ตรวจสอบความยาว
  
  -- สร้างเลขใหม่: prefix + date + (last_number + sequence_order)
  -- ใช้ last_number ที่มากที่สุดระหว่าง orders ทั้งหมดและ orders ในทริปเดียวกัน
  v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');
  
  -- ตรวจสอบว่าเลขที่สร้างไม่ซ้ำ (ถ้าซ้ำให้เพิ่ม last_number)
  -- แต่ต้องไม่เพิ่ม sequence_order เพราะ sequence_order ต้องคงที่
  WHILE EXISTS (
    SELECT 1 FROM public.orders 
    WHERE order_number = v_new_number 
      AND id != p_order_id
  ) LOOP
    -- เพิ่ม last_number เท่านั้น (ไม่เพิ่ม sequence_order)
    v_last_number := v_last_number + 1;
    v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');
    v_attempts := v_attempts + 1;
    
    -- ป้องกัน infinite loop (เพิ่มเป็น 1000)
    IF v_attempts > 1000 THEN
      RAISE EXCEPTION 'Cannot generate unique order_number after 1000 attempts. Date: %, Last: %, Seq: %, New: %', v_date_prefix, v_last_number, v_sequence_order, v_new_number;
    END IF;
  END LOOP;
  
  RETURN v_new_number;
END;
$$;

-- Function 2: generate_order_numbers_for_trip
CREATE OR REPLACE FUNCTION public.generate_order_numbers_for_trip(p_trip_id UUID)
RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
DECLARE 
  v_order_record RECORD; 
  v_new_number TEXT;
BEGIN
  FOR v_order_record IN
    SELECT o.id, o.order_number FROM public.orders o
    INNER JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id
    WHERE o.delivery_trip_id = p_trip_id AND dts.delivery_trip_id = p_trip_id
    ORDER BY dts.sequence_order ASC
  LOOP
    IF v_order_record.order_number IS NULL OR v_order_record.order_number = '' THEN
      -- เรียก function ด้วย schema ที่ชัดเจน
      v_new_number := public.generate_order_number_for_trip(v_order_record.id, p_trip_id);
      UPDATE public.orders SET order_number = v_new_number WHERE id = v_order_record.id;
      order_id := v_order_record.id; 
      order_number := v_new_number; 
      RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

-- Function 3: trigger_generate_order_number_on_trip_assignment
CREATE OR REPLACE FUNCTION public.trigger_generate_order_number_on_trip_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_trip_id UUID;
  v_new_number TEXT;
BEGIN
  IF OLD.delivery_trip_id IS NULL AND NEW.delivery_trip_id IS NOT NULL THEN
    v_order_id := NEW.id;
    v_trip_id := NEW.delivery_trip_id;
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
      -- เรียก function ด้วย schema ที่ชัดเจน
      v_new_number := public.generate_order_number_for_trip(v_order_id, v_trip_id);
      NEW.order_number := v_new_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ========================================
-- STEP 2: แก้ไข RLS Policies (สำคัญมาก!)
-- ========================================

-- ลบ policies เก่าทั้งหมด (ต้องลบก่อนสร้างใหม่)
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view orders" ON public.orders;
DROP POLICY IF EXISTS "Owner and admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are viewable by everyone" ON public.orders;

-- สร้าง SELECT policy (ดูข้อมูล) - ต้องมีก่อน UPDATE
CREATE POLICY "Staff can view orders" ON public.orders 
FOR SELECT 
TO authenticated
USING ((select auth.uid()) IS NOT NULL);

-- สร้าง UPDATE policy (แก้ไขข้อมูล)
CREATE POLICY "Staff can update orders" ON public.orders 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) 
    AND role IN ('admin', 'manager', 'user', 'sales', 'inspector')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) 
    AND role IN ('admin', 'manager', 'user', 'sales', 'inspector')
  )
);

-- ========================================
-- STEP 3: สร้าง Trigger
-- ========================================

CREATE TRIGGER trigger_generate_order_number_on_trip_assignment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.delivery_trip_id IS DISTINCT FROM NEW.delivery_trip_id
    AND NEW.delivery_trip_id IS NOT NULL
    AND (NEW.order_number IS NULL OR NEW.order_number = '')
  )
  EXECUTE FUNCTION public.trigger_generate_order_number_on_trip_assignment();

-- ========================================
-- STEP 4: แก้ไขข้อมูลเก่า
-- ========================================

UPDATE public.orders
SET status = 'assigned'
WHERE delivery_trip_id IS NOT NULL AND status = 'pending';

-- ========================================
-- STEP 5: ตรวจสอบผลลัพธ์
-- ========================================

-- ตรวจสอบ Functions
SELECT 
  '✅ Functions' as status,
  CASE WHEN COUNT(*) FILTER (WHERE proname = 'generate_order_number_for_trip') = 1 THEN '✅ SUCCESS' ELSE '❌ MISSING' END as fn1,
  CASE WHEN COUNT(*) FILTER (WHERE proname = 'generate_order_numbers_for_trip') = 1 THEN '✅ SUCCESS' ELSE '❌ MISSING' END as fn2,
  CASE WHEN COUNT(*) FILTER (WHERE proname = 'trigger_generate_order_number_on_trip_assignment') = 1 THEN '✅ SUCCESS' ELSE '❌ MISSING' END as fn3
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
-- ตรวจสอบ Policies
SELECT 
  '✅ Policies' as status,
  CASE WHEN COUNT(*) FILTER (WHERE policyname = 'Staff can view orders') = 1 THEN '✅ SUCCESS' ELSE '❌ MISSING' END as fn1,
  CASE WHEN COUNT(*) FILTER (WHERE policyname = 'Staff can update orders') = 1 THEN '✅ SUCCESS' ELSE '❌ MISSING' END as fn2,
  'N/A' as fn3
FROM pg_policies 
WHERE tablename = 'orders'
UNION ALL
-- ตรวจสอบ Triggers
SELECT 
  '✅ Triggers' as status,
  CASE WHEN COUNT(*) FILTER (WHERE tgname = 'trigger_generate_order_number_on_trip_assignment') = 1 THEN '✅ SUCCESS' ELSE '❌ MISSING' END as fn1,
  'N/A' as fn2,
  'N/A' as fn3
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'orders';

-- ========================================
-- ถ้าเห็น ✅ SUCCESS ทั้งหมด = สำเร็จ!
-- ========================================
