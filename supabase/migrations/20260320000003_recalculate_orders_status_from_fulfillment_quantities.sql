-- ============================================================
-- Recalc order.status from existing fulfillment quantities
-- Used when unassigning/deleting a trip that is NOT completed:
--   - reset quantity_delivered = 0 first (clear stale values from other completed trips)
--   - only recalculate orders.status from quantity_picked_up_at_store
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_orders_status_from_fulfillment_quantities(
  p_order_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ord RECORD;
  v_total_qty numeric;
  v_total_fulfilled numeric;
BEGIN
  IF p_order_ids IS NULL OR cardinality(p_order_ids) = 0 THEN
    RETURN;
  END IF;

  -- ล้างค่า quantity_delivered ที่ค้างจากทริป completed อื่นก่อน
  -- เมื่อถอดออเดอร์จากทริปที่ยังไม่ completed ค่า quantity_delivered เหล่านี้
  -- ถูกเขียนโดย trigger/backfill ของทริปอื่น และไม่ควรนำมาใช้คำนวณ status
  -- ของออเดอร์ที่กำลังจะถูก unassign อีกต่อไป
  UPDATE public.order_items oi
  SET quantity_delivered = 0, updated_at = now()
  FROM public.orders o
  WHERE oi.order_id = o.id
    AND o.id = ANY(p_order_ids)
    AND o.status <> 'cancelled'
    AND COALESCE(oi.fulfillment_method, 'delivery') <> 'pickup';

  FOR v_ord IN
    SELECT id, COALESCE(delivery_trip_id, NULL) AS delivery_trip_id
    FROM public.orders
    WHERE id = ANY(p_order_ids)
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
    ELSE
      UPDATE public.orders
      SET status = 'confirmed', updated_at = now()
      WHERE id = v_ord.id;
    END IF;
  END LOOP;
END;
$$;

