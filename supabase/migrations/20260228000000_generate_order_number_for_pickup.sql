-- Migration: สร้าง order_number สำหรับออเดอร์รับเองทั้งหมด (ไม่ได้จัดทริป)
-- หลักการ: เลขออเดอร์/เลขบิลต้องต่อเนื่องกัน (001, 002, 003...) ไม่ว่าจะรับเองหรือจัดส่ง
-- ใช้ pool เดียวกับ generate_order_number_for_trip + lock key เดียวกัน เพื่อไม่ให้เลขซ้ำหรือข้าม
-- รูปแบบ: SD/HQ + YYMMDD + เลข 3 หลัก (เช่น SD260228001, 002, 003)
-- ========================================

CREATE OR REPLACE FUNCTION public.generate_order_number_for_pickup(p_order_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_order_record RECORD;
  v_warehouse_type TEXT;
  v_store_branch TEXT;
  v_order_date DATE;
  v_year TEXT;
  v_month TEXT;
  v_day TEXT;
  v_date_prefix TEXT;
  v_prefix TEXT;
  v_suffix INTEGER;
  v_new_number TEXT;
  v_lock_key BIGINT;
BEGIN
  SELECT o.id, o.store_id, o.order_date, o.warehouse_id, o.order_number
  INTO v_order_record
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF v_order_record IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- มีเลขจริงอยู่แล้ว → ไม่สร้างใหม่
  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != ''
     AND v_order_record.order_number NOT LIKE 'TEMP-%' THEN
    RETURN v_order_record.order_number;
  END IF;

  -- ใช้วันที่ออเดอร์ (order_date) — ต้องตรงกับหลักการวันเดียวกันกับออเดอร์จัดส่ง
  IF v_order_record.order_date IS NOT NULL THEN
    v_order_date := v_order_record.order_date;
  ELSE
    v_order_date := CURRENT_DATE;
  END IF;

  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;

  -- ใช้ lock key เดียวกับ generate_order_number_for_trip เพื่อให้เลขต่อเนื่องและไม่ race
  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- prefix ตรงกับ trip: warehouse.type = branch → SD, อื่นๆ → HQ
  v_prefix := 'HQ';
  IF v_order_record.warehouse_id IS NOT NULL THEN
    SELECT type INTO v_warehouse_type FROM public.warehouses WHERE id = v_order_record.warehouse_id;
    IF v_warehouse_type = 'branch' THEN
      v_prefix := 'SD';
    END IF;
  ELSIF v_order_record.store_id IS NOT NULL THEN
    SELECT branch INTO v_store_branch FROM public.stores WHERE id = v_order_record.store_id;
    IF v_store_branch = 'SD' THEN
      v_prefix := 'SD';
    END IF;
  END IF;

  -- หา suffix ถัดไป (ร่วม pool กับออเดอร์จัดทริป — เช็คจาก orders ทั้งหมด)
  v_suffix := 1;
  v_new_number := v_prefix || v_date_prefix || LPAD(v_suffix::TEXT, 3, '0');
  WHILE EXISTS (
    SELECT 1 FROM public.orders
    WHERE order_number = v_new_number AND id != p_order_id
  ) LOOP
    v_suffix := v_suffix + 1;
    v_new_number := v_prefix || v_date_prefix || LPAD(v_suffix::TEXT, 3, '0');
  END LOOP;

  RETURN v_new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.generate_order_number_for_pickup IS
  'สร้าง order_number SD/HQ+YYMMDD+เลข 3 หลัก สำหรับออเดอร์รับเอง — ใช้ pool และ lock เดียวกับออเดอร์จัดทริป เพื่อให้เลขบิลต่อเนื่องกันตามมาตรฐาน';
