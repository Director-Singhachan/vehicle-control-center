-- ========================================
-- Fix duplicate order_number: เลขออเดอร์เริ่มใหม่ทุกวัน
-- Migration: 20260230000001_fix_order_number_unique.sql
-- ========================================
-- รูปแบบ: SD+YYMMDD+เลข 3 หลัก / HQ+YYMMDD+เลข 3 หลัก (เช่น SD260130001, 002, 003)
-- แต่ละวันเริ่มจาก 001 ใหม่ (วันใหม่ = เลขเริ่มใหม่)
-- ใช้วันที่จัดทริป (planned_date) เป็นหลัก — ไม่ยึดวันที่สร้างออเดอร์ (order_date)
-- หา suffix ถัดไปที่ยังไม่ถูกใช้ (WHILE loop) เพื่อไม่ซ้ำ
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
  v_order_date DATE;
  v_year TEXT;
  v_month TEXT;
  v_day TEXT;
  v_date_prefix TEXT;  -- YYMMDD (วันใหม่ = เลขเริ่มใหม่)
  v_prefix TEXT;       -- SD หรือ HQ
  v_suffix INTEGER;
  v_new_number TEXT;
  v_lock_key BIGINT;
BEGIN
  SELECT o.id, o.store_id, o.order_date, o.warehouse_id, o.order_number
  INTO v_order_record FROM public.orders o WHERE o.id = p_order_id;

  IF v_order_record IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- มีเลขจริงอยู่แล้ว (ไม่รวม TEMP- ที่ RPC ใส่ชั่วคราว) → ไม่สร้างใหม่
  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != ''
     AND v_order_record.order_number NOT LIKE 'TEMP-%' THEN
    RETURN v_order_record.order_number;
  END IF;

  SELECT dt.id, dt.planned_date INTO v_trip_record
  FROM public.delivery_trips dt WHERE dt.id = p_trip_id;

  IF v_trip_record IS NULL THEN
    RAISE EXCEPTION 'Delivery trip not found: %', p_trip_id;
  END IF;

  -- ใช้วันที่จัดทริป (planned_date) เป็นหลัก — เลขออเดอร์เป็นของวันนั้นๆ ที่จัดทริป ไม่ยึดวันที่สร้างรายการ
  IF v_trip_record.planned_date IS NOT NULL THEN
    v_order_date := v_trip_record.planned_date;
  ELSIF v_order_record.order_date IS NOT NULL THEN
    v_order_date := v_order_record.order_date;
  ELSE
    v_order_date := CURRENT_DATE;
  END IF;

  -- รูปแบบ SD/HQ + YYMMDD + เลข 3 หลัก (วันใหม่ = 001 เริ่มใหม่)
  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;

  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF v_order_record.warehouse_id IS NOT NULL THEN
    SELECT type INTO v_warehouse_type FROM public.warehouses WHERE id = v_order_record.warehouse_id;
  END IF;

  IF v_warehouse_type = 'branch' AND v_order_record.warehouse_id IS NOT NULL THEN
    v_prefix := 'SD';
  ELSE
    v_prefix := 'HQ';
  END IF;

  -- หา suffix ถัดไปที่ยังไม่ถูกใช้ (วันนี้เริ่มจาก 001, 002, 003 ...)
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
  'สร้าง order_number รูปแบบ SD/HQ+YYMMDD+เลข 3 หลัก — ใช้วันที่จัดทริป (planned_date) เป็นหลัก ไม่ยึดวันที่สร้างออเดอร์ แต่ละวันเริ่มจาก 001 ใหม่';
