-- ============================================================
-- Sync order status when delivery trip is completed
-- ============================================================
-- เมื่อทริปจัดส่งถูกปิด (status = 'completed') ระบบจะ:
-- 1. อัปเดต order_items.quantity_delivered ตามยอดจากทริป (แจกจ่ายแบบ FIFO — ออเดอร์เก่าก่อน)
-- 2. อัปเดต orders.status เป็น 'delivered' หรือ 'partial' ตามยอดส่งครบหรือไม่
-- ทำให้หน้าติดตามออเดอร์ (Track Orders) แสดงสถานะถูกต้องหลังลงเลขไมล์ขากลับ
--
-- สำคัญ:
-- - ยอดส่งแจกจ่ายแบบ FIFO (ออเดอร์เก่าก่อน) ไม่ให้ยอดไปรวมที่ออเดอร์เดียว
-- - เฉพาะออเดอร์ที่กำหนดทริปนี้แล้ว (delivery_trip_id = ทริปที่ completed) จะถูกอัปเดต
--   ออเดอร์ที่ยังไม่ได้จัดทริป (delivery_trip_id IS NULL) จะไม่ถูกแตะ
--
-- หลังรัน migration นี้:
-- - ทริปที่ปิดในอนาคต: สถานะออเดอร์จะอัปเดตอัตโนมัติ (trigger + RPC)
-- - ทริปที่ completed ไปแล้วก่อนมี migration: รัน backfill ย้อนหลังครั้งเดียว (ข้อ 3 ด้านล่าง)
-- ============================================================

-- 1. Trigger function: อัปเดต order_items + orders เมื่อ delivery_trips.status → completed
CREATE OR REPLACE FUNCTION public.sync_fulfilled_quantities_on_trip_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_store        RECORD;
  v_order        RECORD;
  v_order_item   RECORD;
  v_trip_item    RECORD;
  v_total_delivered numeric;
  v_remaining   numeric;
  v_assign       numeric;
  v_new_order_status text;
  v_total_qty       numeric;
  v_total_fulfilled numeric;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  FOR v_store IN
    SELECT dts.id AS trip_store_id, dts.store_id
    FROM public.delivery_trip_stores dts
    WHERE dts.delivery_trip_id = NEW.id
  LOOP
    FOR v_trip_item IN
      SELECT dti.product_id, dti.quantity
      FROM public.delivery_trip_items dti
      WHERE dti.delivery_trip_store_id = v_store.trip_store_id
    LOOP
      SELECT COALESCE(SUM(dti2.quantity), 0) INTO v_total_delivered
      FROM public.delivery_trip_items dti2
      JOIN public.delivery_trip_stores dts2 ON dts2.id = dti2.delivery_trip_store_id
      JOIN public.delivery_trips dt2 ON dt2.id = dts2.delivery_trip_id
      WHERE dt2.status = 'completed'
        AND dts2.store_id = v_store.store_id
        AND dti2.product_id = v_trip_item.product_id
        AND dt2.created_at <= NEW.created_at;

      v_remaining := v_total_delivered;

      FOR v_order IN
        SELECT DISTINCT o.id AS order_id, o.created_at
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
        WHERE o.store_id = v_store.store_id
          AND o.delivery_trip_id = NEW.id
          AND o.status IN ('confirmed', 'partial', 'assigned')
          AND oi.product_id = v_trip_item.product_id
          AND o.created_at <= NEW.created_at
        ORDER BY o.created_at ASC
      LOOP
        EXIT WHEN v_remaining <= 0;
        FOR v_order_item IN
          SELECT oi.id, oi.quantity, oi.quantity_picked_up_at_store, oi.quantity_delivered
          FROM public.order_items oi
          WHERE oi.order_id = v_order.order_id
            AND oi.product_id = v_trip_item.product_id
        LOOP
          v_assign := LEAST(v_remaining, v_order_item.quantity);
          UPDATE public.order_items
          SET quantity_delivered = v_assign, updated_at = NOW()
          WHERE id = v_order_item.id;
          v_remaining := v_remaining - v_assign;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- อัปเดต orders.status เฉพาะออเดอร์ที่กำหนดทริปนี้แล้ว (ไม่แตะออเดอร์ที่ยังไม่มีทริป)
  FOR v_order IN
    SELECT DISTINCT o.id AS order_id
    FROM public.orders o
    JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id AND dts.delivery_trip_id = NEW.id
    WHERE o.delivery_trip_id = NEW.id
      AND o.status NOT IN ('cancelled', 'delivered')
  LOOP
    SELECT
      COALESCE(SUM(oi.quantity), 0),
      COALESCE(SUM(COALESCE(oi.quantity_picked_up_at_store, 0) + COALESCE(oi.quantity_delivered, 0)), 0)
    INTO v_total_qty, v_total_fulfilled
    FROM public.order_items oi
    WHERE oi.order_id = v_order.order_id;

    IF v_total_qty > 0 AND v_total_fulfilled >= v_total_qty THEN
      v_new_order_status := 'delivered';
    ELSIF v_total_fulfilled > 0 THEN
      v_new_order_status := 'partial';
    ELSE
      v_new_order_status := NULL;
    END IF;

    IF v_new_order_status IS NOT NULL THEN
      UPDATE public.orders
      SET status = v_new_order_status, updated_at = NOW()
      WHERE id = v_order.order_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_fulfilled_quantities_on_trip_complete IS
  'Auto-update order_items.quantity_delivered and orders.status when delivery_trip is completed. Used so Track Orders page shows correct status after vehicle check-in.';

DROP TRIGGER IF EXISTS trg_sync_fulfilled_on_trip_complete ON public.delivery_trips;
CREATE TRIGGER trg_sync_fulfilled_on_trip_complete
  AFTER UPDATE OF status ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fulfilled_quantities_on_trip_complete();


-- 2. RPC: backfill quantity_delivered และอัปเดต orders.status สำหรับทริปที่ completed แล้ว
--    (ใช้เมื่อแอปเรียกหลังปิดทริป เพื่อให้สถานะออเดอร์ตรงแม้ trigger ไม่รันหรือต้อง sync ย้อนหลัง)
CREATE OR REPLACE FUNCTION public.backfill_quantity_delivered_for_trip(p_trip_id uuid)
RETURNS TABLE(
  order_id uuid,
  order_number text,
  item_id uuid,
  product_code text,
  product_name text,
  ordered_qty numeric,
  old_delivered numeric,
  new_delivered numeric,
  updated boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_store        RECORD;
  v_order        RECORD;
  v_order_item   RECORD;
  v_trip_item    RECORD;
  v_total_delivered numeric;
  v_remaining   numeric;
  v_assign       numeric;
  v_old_delivered numeric;
  v_total_qty numeric;
  v_total_fulfilled numeric;
  v_new_order_status text;
  v_current_order_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_trips dt
    WHERE dt.id = p_trip_id AND dt.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Trip % is not completed', p_trip_id;
  END IF;

  FOR v_store IN
    SELECT dts.id AS trip_store_id, dts.store_id
    FROM public.delivery_trip_stores dts
    WHERE dts.delivery_trip_id = p_trip_id
  LOOP
    FOR v_trip_item IN
      SELECT dti.product_id, dti.quantity
      FROM public.delivery_trip_items dti
      WHERE dti.delivery_trip_store_id = v_store.trip_store_id
    LOOP
      SELECT COALESCE(SUM(dti2.quantity), 0) INTO v_total_delivered
      FROM public.delivery_trip_items dti2
      JOIN public.delivery_trip_stores dts2 ON dts2.id = dti2.delivery_trip_store_id
      JOIN public.delivery_trips dt2 ON dt2.id = dts2.delivery_trip_id
      WHERE dt2.status = 'completed'
        AND dts2.store_id = v_store.store_id
        AND dti2.product_id = v_trip_item.product_id;

      v_remaining := v_total_delivered;

      FOR v_order IN
        SELECT DISTINCT o.id AS order_id, o.order_number, o.created_at
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
        WHERE o.store_id = v_store.store_id
          AND o.delivery_trip_id = p_trip_id
          AND o.status IN ('confirmed', 'partial', 'assigned')
          AND oi.product_id = v_trip_item.product_id
        ORDER BY o.created_at ASC
      LOOP
        EXIT WHEN v_remaining <= 0;
        FOR v_order_item IN
          SELECT oi.id, oi.quantity, oi.quantity_picked_up_at_store, oi.quantity_delivered
          FROM public.order_items oi
          WHERE oi.order_id = v_order.order_id
            AND oi.product_id = v_trip_item.product_id
        LOOP
          v_old_delivered := COALESCE(v_order_item.quantity_delivered, 0);
          v_assign := LEAST(v_remaining, v_order_item.quantity);
          UPDATE public.order_items
          SET quantity_delivered = v_assign, updated_at = NOW()
          WHERE id = v_order_item.id;
          v_remaining := v_remaining - v_assign;

          RETURN QUERY
          SELECT
            v_order.order_id,
            v_order.order_number,
            v_order_item.id,
            p.product_code,
            p.product_name,
            v_order_item.quantity::numeric,
            v_old_delivered,
            v_assign,
            (v_assign <> v_old_delivered)::boolean
          FROM public.products p
          WHERE p.id = v_trip_item.product_id;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- อัปเดต orders.status เฉพาะออเดอร์ที่กำหนดทริปนี้แล้ว
  FOR v_order IN
    SELECT DISTINCT o.id AS order_id
    FROM public.orders o
    JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id AND dts.delivery_trip_id = p_trip_id
    WHERE o.delivery_trip_id = p_trip_id
      AND o.status NOT IN ('cancelled', 'delivered')
  LOOP
    v_current_order_id := v_order.order_id;
    SELECT
      COALESCE(SUM(oi.quantity), 0),
      COALESCE(SUM(COALESCE(oi.quantity_picked_up_at_store, 0) + COALESCE(oi.quantity_delivered, 0)), 0)
    INTO v_total_qty, v_total_fulfilled
    FROM public.order_items oi
    WHERE oi.order_id = v_current_order_id;

    IF v_total_qty > 0 AND v_total_fulfilled >= v_total_qty THEN
      v_new_order_status := 'delivered';
    ELSIF v_total_fulfilled > 0 THEN
      v_new_order_status := 'partial';
    ELSE
      v_new_order_status := NULL;
    END IF;

    IF v_new_order_status IS NOT NULL THEN
      UPDATE public.orders
      SET status = v_new_order_status, updated_at = NOW()
      WHERE id = v_current_order_id;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.backfill_quantity_delivered_for_trip(uuid) IS
  'Backfill order_items.quantity_delivered and update orders.status for a completed trip. Called by app after trip check-in so Track Orders page shows correct status.';

-- 3. One-time: อัปเดตสถานะออเดอร์ย้อนหลังสำหรับทริปที่ completed ไปแล้วก่อนมี migration นี้
--    ทำให้หน้าติดตามออเดอร์แสดง "จัดส่งแล้ว" ถูกต้องสำหรับออเดอร์ที่ผ่านมาด้วย
DO $$
DECLARE
  r RECORD;
  n integer := 0;
BEGIN
  FOR r IN SELECT id, trip_number FROM public.delivery_trips WHERE status = 'completed'
  LOOP
    BEGIN
      PERFORM * FROM public.backfill_quantity_delivered_for_trip(r.id);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Backfill skipped for trip % (%): %', r.trip_number, r.id, SQLERRM;
    END;
  END LOOP;
  IF n > 0 THEN
    RAISE NOTICE 'Synced order status for % completed trip(s).', n;
  END IF;
END;
$$;
