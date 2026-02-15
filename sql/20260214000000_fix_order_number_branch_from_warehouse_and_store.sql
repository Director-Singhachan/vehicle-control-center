-- ========================================
-- Fix: รหัสออเดอร์ต้องเป็นสาขา (SD) เมื่อลูกค้า/คลังเป็นสาขา
-- Migration: 20260214000000_fix_order_number_branch_from_warehouse_and_store.sql
-- ========================================
-- ปัญหา: บางครั้งรหัสออเดอร์ออกเป็น HQ ทั้งที่ลูกค้าตั้งเป็นสาขา และฝ่ายขายเลือกคลังสาขาแล้ว
-- สาเหตุ: ใช้แค่ warehouses.type เท่านั้น และเมื่อ warehouse_id เป็น null ก็ตก HQ เสมอ
-- แก้: ใช้ warehouses.branch หรือ warehouses.type จากคลังที่เลือก และ fallback เป็น orders.branch (จากร้าน/ลูกค้า)
-- ========================================

CREATE OR REPLACE FUNCTION generate_order_number_for_trip(
  p_order_id UUID,
  p_trip_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_order_record RECORD;
  v_trip_record RECORD;
  v_warehouse_type TEXT;
  v_warehouse_branch TEXT;
  v_order_date DATE;
  v_year TEXT;
  v_month TEXT;
  v_day TEXT;
  v_date_prefix TEXT;
  v_prefix TEXT;
  v_suffix INTEGER;
  v_new_number TEXT;
  v_lock_key BIGINT;
  v_use_sd BOOLEAN;
BEGIN
  -- ดึงออเดอร์รวมถึง branch (ที่ trigger อัพเดทจาก warehouse/store/user)
  SELECT o.id, o.store_id, o.order_date, o.warehouse_id, o.order_number, o.branch AS order_branch
  INTO v_order_record
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF v_order_record IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != ''
     AND v_order_record.order_number NOT LIKE 'TEMP-%' THEN
    RETURN v_order_record.order_number;
  END IF;

  SELECT dt.id, dt.planned_date INTO v_trip_record
  FROM public.delivery_trips dt
  WHERE dt.id = p_trip_id;

  IF v_trip_record IS NULL THEN
    RAISE EXCEPTION 'Delivery trip not found: %', p_trip_id;
  END IF;

  IF v_trip_record.planned_date IS NOT NULL THEN
    v_order_date := v_trip_record.planned_date;
  ELSIF v_order_record.order_date IS NOT NULL THEN
    v_order_date := v_order_record.order_date;
  ELSE
    v_order_date := CURRENT_DATE;
  END IF;

  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;

  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- กำหนด SD vs HQ: ใช้ทั้ง warehouse (branch/type) และ order.branch (จากร้าน/ลูกค้า)
  v_use_sd := FALSE;

  -- 1) จากคลังที่เลือก: ดูทั้ง branch และ type (เผื่อใน DB บางคลัง type ผิดแต่ branch ถูก)
  IF v_order_record.warehouse_id IS NOT NULL THEN
    SELECT w.type, w.branch INTO v_warehouse_type, v_warehouse_branch
    FROM public.warehouses w
    WHERE w.id = v_order_record.warehouse_id;

    IF v_warehouse_branch = 'SD' OR v_warehouse_type = 'branch' THEN
      v_use_sd := TRUE;
    END IF;
  END IF;

  -- 2) Fallback: ถ้ายังไม่ใช่สาขา ให้ดู orders.branch (trigger อัพเดทจาก store/customer/user แล้ว)
  IF NOT v_use_sd AND v_order_record.order_branch IS NOT NULL THEN
    IF v_order_record.order_branch = 'SD'
       OR v_order_record.order_branch ILIKE '%สอยดาว%'
       OR v_order_record.order_branch ILIKE '%SD%' THEN
      v_use_sd := TRUE;
    END IF;
  END IF;

  IF v_use_sd THEN
    v_prefix := 'SD';
  ELSE
    v_prefix := 'HQ';
  END IF;

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

COMMENT ON FUNCTION generate_order_number_for_trip IS
  'สร้าง order_number SD/HQ+YYMMDD+เลข 3 หลัก — ใช้ warehouse.branch/type ก่อน แล้ว fallback เป็น orders.branch (จากร้าน/ลูกค้า) เพื่อให้รหัสตรงสาขาจริง';
