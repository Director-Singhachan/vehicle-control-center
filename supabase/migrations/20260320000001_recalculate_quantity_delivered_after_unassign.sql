-- ============================================================
-- หลังยกเลิก/ลบทริป: คำนวณ quantity_delivered ใหม่แบบ FIFO ต่อร้าน+สินค้า
-- แทน logic เดิมในแอปที่ใช้ min(ยอดรวมร้าน, จำนวนบรรทัด) ทุกบรรทัด (ผิด)
-- p_excluded_trip_id: ใช้ตอนลบทริป — ไม่นับยอดจากทริปนี้ใน pool (กรณีทริป completed ก่อนลบ)
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_quantity_delivered_after_order_unassign(
  p_order_ids uuid[],
  p_excluded_trip_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_product_id uuid;
  v_pool numeric;
  v_allocated_other numeric;
  v_remaining numeric;
  v_ord RECORD;
  v_oi RECORD;
  v_assign numeric;
  v_total_qty numeric;
  v_total_fulfilled numeric;
  v_stores uuid[];
BEGIN
  IF p_order_ids IS NULL OR cardinality(p_order_ids) = 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT o.store_id), ARRAY[]::uuid[])
  INTO v_stores
  FROM public.orders o
  WHERE o.id = ANY(p_order_ids)
    AND o.store_id IS NOT NULL;

  IF v_stores IS NULL OR cardinality(v_stores) = 0 THEN
    RETURN;
  END IF;

  FOREACH v_store_id IN ARRAY v_stores
  LOOP
    FOR v_product_id IN
      SELECT DISTINCT oi.product_id
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.store_id = v_store_id
        AND o.id = ANY(p_order_ids)
        AND o.status <> 'cancelled'
        AND COALESCE(oi.fulfillment_method, 'delivery') <> 'pickup'
    LOOP
      SELECT COALESCE(SUM(
        GREATEST(
          0::numeric,
          COALESCE(dti.quantity, 0) - COALESCE(dti.quantity_picked_up_at_store, 0)
        )
      ), 0) INTO v_pool
      FROM public.delivery_trip_items dti
      JOIN public.delivery_trip_stores dts ON dts.id = dti.delivery_trip_store_id
      JOIN public.delivery_trips dt ON dt.id = dts.delivery_trip_id
      WHERE dt.status = 'completed'
        AND dts.store_id = v_store_id
        AND dti.product_id = v_product_id
        AND (p_excluded_trip_id IS NULL OR dt.id <> p_excluded_trip_id);

      -- กันไม่ให้กระทบออเดอร์อื่นที่ไม่ได้อยู่ใน p_order_ids
      -- เราลด pool ด้วยยอดที่ระบบน่าจะจัดสรรให้กับออเดอร์อื่นไว้แล้ว
      SELECT COALESCE(SUM(COALESCE(oi.quantity_delivered, 0)), 0)
      INTO v_allocated_other
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.store_id = v_store_id
        AND o.status <> 'cancelled'
        AND o.id <> ALL(p_order_ids)
        AND oi.product_id = v_product_id
        AND COALESCE(oi.fulfillment_method, 'delivery') <> 'pickup';

      UPDATE public.order_items oi
      SET quantity_delivered = 0, updated_at = now()
      FROM public.orders o
      WHERE oi.order_id = o.id
        AND o.store_id = v_store_id
        AND o.id = ANY(p_order_ids)
        AND o.status <> 'cancelled'
        AND oi.product_id = v_product_id
        AND COALESCE(oi.fulfillment_method, 'delivery') <> 'pickup';

      v_remaining := GREATEST(v_pool - v_allocated_other, 0);

      FOR v_ord IN
        SELECT o.id, o.created_at
        FROM public.orders o
        WHERE o.store_id = v_store_id
          AND o.id = ANY(p_order_ids)
          AND o.status <> 'cancelled'
        ORDER BY o.created_at ASC
      LOOP
        EXIT WHEN v_remaining <= 0;
        FOR v_oi IN
          SELECT oi.id, oi.quantity
          FROM public.order_items oi
          WHERE oi.order_id = v_ord.id
            AND oi.product_id = v_product_id
            AND COALESCE(oi.fulfillment_method, 'delivery') <> 'pickup'
          ORDER BY oi.id
        LOOP
          EXIT WHEN v_remaining <= 0;
          v_assign := LEAST(v_remaining, COALESCE(v_oi.quantity, 0));
          UPDATE public.order_items
          SET quantity_delivered = v_assign, updated_at = now()
          WHERE id = v_oi.id;
          v_remaining := v_remaining - v_assign;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR v_ord IN
    SELECT o.id, o.delivery_trip_id
    FROM public.orders o
    WHERE o.store_id = ANY(v_stores)
      AND o.id = ANY(p_order_ids)
      AND o.status <> 'cancelled'
  LOOP
    SELECT
      COALESCE(SUM(oi.quantity), 0),
      COALESCE(SUM(COALESCE(oi.quantity_picked_up_at_store, 0) + COALESCE(oi.quantity_delivered, 0)), 0)
    INTO v_total_qty, v_total_fulfilled
    FROM public.order_items oi
    WHERE oi.order_id = v_ord.id;

    IF v_total_qty > 0 AND v_total_fulfilled >= v_total_qty THEN
      UPDATE public.orders
      SET status = 'delivered', updated_at = now()
      WHERE id = v_ord.id;
    ELSIF v_total_fulfilled > 0 THEN
      UPDATE public.orders
      SET status = 'partial', updated_at = now()
      WHERE id = v_ord.id;
    ELSIF v_ord.delivery_trip_id IS NOT NULL THEN
      UPDATE public.orders
      SET status = 'assigned', updated_at = now()
      WHERE id = v_ord.id;
    ELSE
      UPDATE public.orders
      SET status = 'confirmed', updated_at = now()
      WHERE id = v_ord.id;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.recalculate_quantity_delivered_after_order_unassign(uuid[], uuid) IS
  'หลังถอดออเดอร์จากทริป: รีแคล์ quantity_delivered แบบ FIFO ต่อร้าน+สินค้า จากทริป completed (ยกเว้น p_excluded_trip_id) แล้วอัปเดต orders.status';
