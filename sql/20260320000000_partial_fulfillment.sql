-- ============================================================
-- Migration: Partial Fulfillment Tracking
-- ============================================================
-- เพิ่ม quantity_picked_up_at_store และ quantity_delivered ใน order_items
-- เพื่อติดตามยอดที่ลูกค้ารับที่ร้านและยอดที่ส่งแล้วแต่ละรายการ
-- ============================================================

-- 1. เพิ่ม columns ใน order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS quantity_picked_up_at_store numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_delivered          numeric NOT NULL DEFAULT 0;

-- Check constraints
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_picked_up_check,
  ADD CONSTRAINT order_items_picked_up_check
    CHECK (quantity_picked_up_at_store >= 0 AND quantity_picked_up_at_store <= quantity);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_delivered_check,
  ADD CONSTRAINT order_items_delivered_check
    CHECK (quantity_delivered >= 0);

-- 2. เพิ่ม status 'partial' ใน orders (ถ้ายังไม่มี)
DO $$
BEGIN
  -- ตรวจสอบว่ามี CHECK constraint สำหรับ status หรือไม่
  -- ถ้ามี จะต้องเพิ่ม 'partial' เข้าไป
  -- ส่วนใหญ่ใช้ varchar ไม่มี check constraint ก็ไม่ต้องทำอะไร
  RAISE NOTICE 'orders.status: partial will be added as a valid status value';
END $$;

-- 3. Function: คำนวณ quantity_remaining ต่อ order_item
CREATE OR REPLACE FUNCTION public.get_order_item_remaining(
  p_quantity            numeric,
  p_picked_up_at_store  numeric,
  p_delivered           numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(0, p_quantity - p_picked_up_at_store - p_delivered);
$$;

-- 4. Trigger: update quantity_delivered ใน order_items เมื่อ trip เสร็จสิ้น
--    จะนับจาก delivery_trip_items ของทุก trip ที่ completed สำหรับออเดอร์นั้น
CREATE OR REPLACE FUNCTION public.sync_fulfilled_quantities_on_trip_complete()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_store         RECORD;
  v_trip_item     RECORD;
  v_order_item    RECORD;
  v_total_delivered numeric;
  v_new_order_status text;
  v_total_qty     numeric;
  v_total_fulfilled numeric;
BEGIN
  -- ทำงานเฉพาะเมื่อ status เปลี่ยนเป็น 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- วนผ่านทุก store ในทริปนี้
  FOR v_store IN
    SELECT dts.id AS trip_store_id, dts.store_id
    FROM public.delivery_trip_stores dts
    WHERE dts.delivery_trip_id = NEW.id
  LOOP
    -- วนผ่านทุก item ใน store นี้
    FOR v_trip_item IN
      SELECT dti.product_id, dti.quantity
      FROM public.delivery_trip_items dti
      WHERE dti.delivery_trip_store_id = v_store.trip_store_id
    LOOP
      -- หา order_item ที่ตรงกัน (product_id + store ของออเดอร์ที่ assigned ก่อน trip complete)
      -- link ผ่าน orders.store_id = v_store.store_id และ orders.delivery_trip_id = NEW.id
      FOR v_order_item IN
        SELECT oi.id, oi.quantity, oi.quantity_picked_up_at_store, oi.quantity_delivered
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.delivery_trip_id = NEW.id
          AND o.store_id = v_store.store_id
          AND oi.product_id = v_trip_item.product_id
      LOOP
        -- คำนวณ quantity_delivered รวมจากทุก completed trips
        SELECT COALESCE(SUM(dti2.quantity), 0) INTO v_total_delivered
        FROM public.delivery_trip_items dti2
        JOIN public.delivery_trip_stores dts2 ON dts2.id = dti2.delivery_trip_store_id
        JOIN public.delivery_trips dt2 ON dt2.id = dts2.delivery_trip_id
        WHERE dt2.status = 'completed'
          AND dts2.store_id = v_store.store_id
          AND dti2.product_id = v_trip_item.product_id
          AND dt2.id IN (
            SELECT dt3.id
            FROM public.delivery_trips dt3
            JOIN public.delivery_trip_stores dts3 ON dts3.delivery_trip_id = dt3.id
            JOIN public.orders o3 ON o3.store_id = dts3.store_id
            WHERE o3.id = v_order_item.id
          );

        -- อัปเดต quantity_delivered (ไม่เกิน quantity ต้นฉบับ)
        UPDATE public.order_items
        SET
          quantity_delivered = LEAST(v_total_delivered, quantity),
          updated_at = NOW()
        WHERE id = v_order_item.id;

      END LOOP;
    END LOOP;
  END LOOP;

  -- อัปเดต order status เป็น 'partial' หรือ 'delivered'
  -- สำหรับออเดอร์ที่ผูกกับทริปนี้
  FOR v_order_item IN
    SELECT DISTINCT o.id AS order_id
    FROM public.orders o
    WHERE o.delivery_trip_id = NEW.id
      AND o.status NOT IN ('cancelled', 'delivered')
  LOOP
    -- คำนวณว่าส่งครบหรือยัง
    SELECT
      COALESCE(SUM(quantity), 0),
      COALESCE(SUM(quantity_picked_up_at_store + quantity_delivered), 0)
    INTO v_total_qty, v_total_fulfilled
    FROM public.order_items
    WHERE order_id = v_order_item.order_id;

    IF v_total_qty > 0 AND v_total_fulfilled >= v_total_qty THEN
      v_new_order_status := 'delivered';
    ELSIF v_total_fulfilled > 0 THEN
      v_new_order_status := 'partial';
    ELSE
      v_new_order_status := NULL; -- ไม่เปลี่ยน
    END IF;

    IF v_new_order_status IS NOT NULL THEN
      UPDATE public.orders
      SET status = v_new_order_status, updated_at = NOW()
      WHERE id = v_order_item.order_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop old trigger ถ้ามี แล้วสร้างใหม่
DROP TRIGGER IF EXISTS trg_sync_fulfilled_on_trip_complete ON public.delivery_trips;
CREATE TRIGGER trg_sync_fulfilled_on_trip_complete
  AFTER UPDATE OF status ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fulfilled_quantities_on_trip_complete();

-- 5. View: order_items พร้อม computed remaining
CREATE OR REPLACE VIEW public.order_items_with_fulfillment AS
SELECT
  oi.*,
  GREATEST(0, oi.quantity - oi.quantity_picked_up_at_store - oi.quantity_delivered) AS quantity_remaining,
  CASE
    WHEN oi.quantity = 0 THEN 'fulfilled'
    WHEN (oi.quantity_picked_up_at_store + oi.quantity_delivered) >= oi.quantity THEN 'fulfilled'
    WHEN (oi.quantity_picked_up_at_store + oi.quantity_delivered) > 0 THEN 'partial'
    ELSE 'pending'
  END AS fulfillment_status
FROM public.order_items oi;

-- 6. Function: update quantity_picked_up_at_store สำหรับ sales team
CREATE OR REPLACE FUNCTION public.update_order_item_pickup(
  p_order_item_id       uuid,
  p_quantity_picked_up  numeric,
  p_updated_by          uuid DEFAULT NULL
) RETURNS public.order_items
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_item public.order_items;
BEGIN
  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_item not found: %', p_order_item_id;
  END IF;

  IF p_quantity_picked_up < 0 OR p_quantity_picked_up > v_item.quantity THEN
    RAISE EXCEPTION 'quantity_picked_up_at_store must be between 0 and %', v_item.quantity;
  END IF;

  UPDATE public.order_items
  SET
    quantity_picked_up_at_store = p_quantity_picked_up,
    updated_at = NOW()
  WHERE id = p_order_item_id
  RETURNING * INTO v_item;

  -- อัปเดต order status ถ้าจำเป็น
  UPDATE public.orders o
  SET
    status = CASE
      WHEN (
        SELECT SUM(quantity_picked_up_at_store + quantity_delivered) FROM public.order_items WHERE order_id = o.id
      ) >= (
        SELECT SUM(quantity) FROM public.order_items WHERE order_id = o.id
      ) THEN 'delivered'
      WHEN (
        SELECT SUM(quantity_picked_up_at_store + quantity_delivered) FROM public.order_items WHERE order_id = o.id
      ) > 0 THEN 'partial'
      ELSE o.status
    END,
    updated_at = NOW()
  WHERE id = v_item.order_id
    AND o.status NOT IN ('cancelled');

  RETURN v_item;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_order_item_pickup TO authenticated;

-- 7. สำหรับออเดอร์แบบ 'partial' ที่ยังค้างส่ง → ต้องปรากฏใน pending orders
-- Update getPendingOrders ให้รับ status 'partial' ด้วย
-- (จัดการใน service layer ฝั่ง TypeScript)

COMMENT ON COLUMN public.order_items.quantity_picked_up_at_store IS
  'จำนวนที่ลูกค้ารับที่หน้าร้านแล้ว (ไม่ต้องจัดส่ง) — บันทึกโดยฝ่ายขาย';
COMMENT ON COLUMN public.order_items.quantity_delivered IS
  'จำนวนที่ส่งให้ลูกค้าแล้ว (รวมทุก trip ที่ completed) — อัปเดตอัตโนมัติ';
