-- ============================================================
-- Fix: sync_fulfilled_quantities_on_trip_complete trigger
-- ============================================================
-- ปัญหาเดิม: Trigger query ผ่าน orders.delivery_trip_id ซึ่งไม่มี column นั้น
-- แก้ไข: link ผ่าน orders.store_id = delivery_trip_stores.store_id
--
-- Logic:
-- เมื่อ delivery_trip เปลี่ยน status → 'completed':
--   1. หา stores ทุกร้านในทริปนี้
--   2. หา orders ที่ส่งให้ร้านนั้นๆ (status IN confirmed/partial)
--   3. หา items ที่ตรงกัน (product_id)
--   4. คำนวณ quantity_delivered = SUM ของทุก completed trip items ที่เคยส่ง
--   5. อัปเดต order status = 'partial' หรือ 'delivered'
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_fulfilled_quantities_on_trip_complete()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_store        RECORD;
  v_order        RECORD;
  v_order_item   RECORD;
  v_trip_item    RECORD;
  v_total_delivered numeric;
  v_new_order_status text;
  v_total_qty       numeric;
  v_total_fulfilled numeric;
BEGIN
  -- ทำงานเฉพาะเมื่อ status เปลี่ยนเป็น 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- 1. วนผ่านทุก store ในทริปนี้
  FOR v_store IN
    SELECT dts.id AS trip_store_id, dts.store_id
    FROM public.delivery_trip_stores dts
    WHERE dts.delivery_trip_id = NEW.id
  LOOP

    -- 2. วนผ่านทุก item ที่ส่งให้ร้านนี้ในทริปนี้
    FOR v_trip_item IN
      SELECT dti.product_id, dti.quantity
      FROM public.delivery_trip_items dti
      WHERE dti.delivery_trip_store_id = v_store.trip_store_id
    LOOP

      -- 3. หา orders ที่ตรงกับร้านนี้ (status = confirmed, partial, หรือ assigned)
      --    และมี order_item ที่ตรง product_id นี้
      FOR v_order IN
        SELECT DISTINCT o.id AS order_id, o.created_at
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
        WHERE o.store_id = v_store.store_id
          AND o.status IN ('confirmed', 'partial', 'assigned')
          AND oi.product_id = v_trip_item.product_id
          AND o.created_at <= NEW.created_at  -- ออเดอร์ที่สร้างก่อนทริปนี้
        ORDER BY o.created_at ASC
        LIMIT 1  -- เลือกออเดอร์เก่าสุดที่ยังค้างส่ง (FIFO)
      LOOP

        -- 4. หา order_item ที่ตรงกัน
        FOR v_order_item IN
          SELECT oi.id, oi.quantity, oi.quantity_picked_up_at_store, oi.quantity_delivered
          FROM public.order_items oi
          WHERE oi.order_id = v_order.order_id
            AND oi.product_id = v_trip_item.product_id
        LOOP

          -- 5. คำนวณ quantity_delivered รวมจากทุก completed trips
          --    ที่เคยส่งสินค้านี้ให้ร้านนี้
          SELECT COALESCE(SUM(dti2.quantity), 0) INTO v_total_delivered
          FROM public.delivery_trip_items dti2
          JOIN public.delivery_trip_stores dts2 ON dts2.id = dti2.delivery_trip_store_id
          JOIN public.delivery_trips dt2 ON dt2.id = dts2.delivery_trip_id
          WHERE dt2.status = 'completed'
            AND dts2.store_id = v_store.store_id
            AND dti2.product_id = v_trip_item.product_id
            AND dt2.created_at <= NEW.created_at;  -- นับเฉพาะ trips ที่เกิดก่อนหรือพร้อมกับทริปนี้

          -- 6. อัปเดต quantity_delivered (ไม่เกิน quantity ที่สั่ง)
          UPDATE public.order_items
          SET
            quantity_delivered = LEAST(v_total_delivered, quantity),
            updated_at = NOW()
          WHERE id = v_order_item.id;

        END LOOP; -- order_item
      END LOOP; -- order
    END LOOP; -- trip_item
  END LOOP; -- store

  -- 7. อัปเดต status ของ orders ที่เกี่ยวข้องกับทริปนี้
  FOR v_order IN
    SELECT DISTINCT o.id AS order_id
    FROM public.orders o
    JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id
    WHERE dts.delivery_trip_id = NEW.id
      AND o.status NOT IN ('cancelled', 'delivered')
  LOOP
    -- คำนวณว่าส่งครบหรือยัง
    SELECT
      COALESCE(SUM(quantity), 0),
      COALESCE(SUM(quantity_picked_up_at_store + quantity_delivered), 0)
    INTO v_total_qty, v_total_fulfilled
    FROM public.order_items
    WHERE order_id = v_order.order_id;

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

-- ลบ trigger เก่าแล้วสร้างใหม่
DROP TRIGGER IF EXISTS trg_sync_fulfilled_on_trip_complete ON public.delivery_trips;
CREATE TRIGGER trg_sync_fulfilled_on_trip_complete
  AFTER UPDATE OF status ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fulfilled_quantities_on_trip_complete();

-- ยืนยัน
COMMENT ON FUNCTION public.sync_fulfilled_quantities_on_trip_complete IS
  'Auto-update order_items.quantity_delivered when delivery_trip is completed. Links via store_id (FIFO — earliest pending order first).';
