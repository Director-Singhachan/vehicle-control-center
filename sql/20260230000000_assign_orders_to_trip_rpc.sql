-- ========================================
-- Assign orders to trip via RPC (fix duplicate order_number)
-- Migration: 20260230000000_assign_orders_to_trip_rpc.sql
-- ========================================
-- ปัญหา: เมื่อ assign ออเดอร์หลายรายการ (แม้ทีละออเดอร์) trigger สร้าง order_number
-- อาจซ้ำได้เพราะ pool ต่างกัน (warehouse/order_date) หรือ race
-- แก้: ทำ assign + สร้างเลขที่ออเดอร์ใน DB ครั้งเดียวผ่าน RPC โดยข้าม trigger ตอน bulk update
-- แล้วให้ generate_order_numbers_for_trip สร้างเลขทีละรายการใน transaction เดียว
-- ========================================

-- 1. แก้ trigger ให้ข้ามการสร้าง order_number เมื่อตั้งค่า session variable
CREATE OR REPLACE FUNCTION trigger_generate_order_number_on_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_trip_id UUID;
  v_new_number TEXT;
  v_skip TEXT;
BEGIN
  -- ถ้า RPC assign_orders_to_trip ตั้งค่าให้ข้าม trigger ให้ไม่สร้าง order_number (จะสร้างใน RPC หลัง update)
  v_skip := current_setting('app.skip_order_number_trigger', true);
  IF v_skip = 'true' THEN
    RETURN NEW;
  END IF;

  -- ตรวจสอบว่า delivery_trip_id เปลี่ยนจาก NULL เป็นมีค่า (assign to trip)
  IF OLD.delivery_trip_id IS NULL AND NEW.delivery_trip_id IS NOT NULL THEN
    v_order_id := NEW.id;
    v_trip_id := NEW.delivery_trip_id;

    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
      v_new_number := generate_order_number_for_trip(v_order_id, v_trip_id);
      NEW.order_number := v_new_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. สร้าง RPC assign_orders_to_trip: update orders แล้วสร้าง order_number ใน transaction เดียว
CREATE OR REPLACE FUNCTION public.assign_orders_to_trip(
  p_order_ids uuid[],
  p_trip_id uuid,
  p_updated_by uuid
)
RETURNS TABLE(updated_count bigint, order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated bigint;
  v_rec RECORD;
BEGIN
  -- ใส่ placeholder ชั่วคราว (TEMP-<id>) เพื่อไม่ให้ trigger สร้างเลขซ้ำ และไม่ชน unique
  -- หลัง loop จะแทนที่ด้วยเลขจริงทีละออเดอร์
  WITH updated AS (
    UPDATE public.orders
    SET
      delivery_trip_id = p_trip_id,
      status = 'assigned',
      updated_by = p_updated_by,
      updated_at = now(),
      order_number = 'TEMP-' || id::text
    WHERE id = ANY(p_order_ids)
      AND (delivery_trip_id IS NULL OR delivery_trip_id != p_trip_id)
    RETURNING id
  )
  SELECT count(*)::bigint INTO v_updated FROM updated;

  -- สร้าง order_number จริงให้ออเดอร์ในทริปตามลำดับ (แทนที่ TEMP-)
  FOR v_rec IN
    SELECT o.id, o.store_id, o.order_number
    FROM public.orders o
    INNER JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id AND dts.delivery_trip_id = p_trip_id
    WHERE o.delivery_trip_id = p_trip_id
    ORDER BY dts.sequence_order ASC, o.id ASC
  LOOP
    IF v_rec.order_number IS NULL OR v_rec.order_number = '' OR v_rec.order_number LIKE 'TEMP-%' THEN
      v_rec.order_number := generate_order_number_for_trip(v_rec.id, p_trip_id);
      UPDATE public.orders SET order_number = v_rec.order_number WHERE id = v_rec.id;
    END IF;
    updated_count := v_updated;
    order_id := v_rec.id;
    order_number := COALESCE(v_rec.order_number, '');
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.assign_orders_to_trip IS
  'Assign orders to trip and generate order_number in one transaction to avoid duplicate order_number. Use this instead of updating orders from the app when assigning multiple orders.';
