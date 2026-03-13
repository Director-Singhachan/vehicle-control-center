-- ============================================================
-- Fix: (1) แจกจ่ายยอดส่งแบบ FIFO (2) เฉพาะออเดอร์ที่กำหนดทริปแล้ว
-- ============================================================
-- - ออเดอร์ที่ยังไม่ได้จัดทริป (delivery_trip_id IS NULL) จะไม่ถูกอัปเดตยอดส่ง/สถานะ
-- - เฉพาะออเดอร์ที่ delivery_trip_id = ทริปที่ completed จะได้ quantity_delivered และ status
-- รัน migration นี้แล้วล้างยอดผิดของออเดอร์ที่ยังไม่มีทริป แล้วรัน backfill ใหม่
-- ============================================================

-- 1. Trigger function (แก้แล้ว: แจก v_total_delivered แบบ FIFO)
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

-- 2. RPC backfill (แก้แล้ว: แจกยอดส่งแบบ FIFO)
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

-- 3. ล้างยอดส่งผิดของออเดอร์ที่ยังไม่ได้กำหนดทริป แต่ได้ quantity_delivered ผิดจาก backfill
--    เฉพาะออเดอร์ที่มี order_item.quantity_delivered > 0 (ไม่แตะออเดอร์รับเองที่ fulfill จาก quantity_picked_up_at_store)
--    ต้องรีเซ็ต status ก่อน แล้วค่อย zero quantity_delivered (เพราะหลัง zero แล้วจะหา order ที่ต้อง reset ไม่เจอ)
UPDATE public.orders
SET status = 'confirmed', updated_at = NOW()
WHERE delivery_trip_id IS NULL
  AND status IN ('partial', 'delivered')
  AND id IN (
    SELECT DISTINCT oi.order_id FROM public.order_items oi
    WHERE COALESCE(oi.quantity_delivered, 0) > 0
      AND oi.order_id IN (SELECT id FROM public.orders WHERE delivery_trip_id IS NULL)
  );

UPDATE public.order_items
SET quantity_delivered = 0, updated_at = NOW()
WHERE order_id IN (
  SELECT o.id FROM public.orders o
  WHERE o.delivery_trip_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = o.id AND COALESCE(oi.quantity_delivered, 0) > 0
    )
);

-- 4. รัน backfill ใหม่สำหรับทุกทริปที่ completed (เฉพาะออเดอร์ที่กำหนดทริปนั้นแล้ว)
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
    RAISE NOTICE 'Re-synced order status for % completed trip(s) (FIFO fix).', n;
  END IF;
END;
$$;
