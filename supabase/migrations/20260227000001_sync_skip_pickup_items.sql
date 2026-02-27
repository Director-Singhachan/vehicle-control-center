-- Migration: sync_order_items_to_trip — ไม่ sync รายการ fulfillment_method = 'pickup'
-- รายการ pickup = ลูกค้ามารับเอง ไม่ต้องจัดทริป → ไม่มีใน delivery_trip_items

CREATE OR REPLACE FUNCTION sync_order_items_to_trip()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_order_record RECORD;
  v_trip_store_record RECORD;
  v_existing_trip_item RECORD;
  v_fulfillment_method text;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  -- ข้ามรายการ pickup (ลูกค้ามารับเอง ไม่ sync ลง delivery_trip_items)
  IF TG_OP = 'DELETE' THEN
    v_fulfillment_method := COALESCE(OLD.fulfillment_method, 'delivery');
    IF v_fulfillment_method = 'pickup' THEN
      RETURN OLD;  -- pickup ไม่เคย sync ไม่ต้องลบ
    END IF;
  ELSE
    v_fulfillment_method := COALESCE(NEW.fulfillment_method, 'delivery');
    IF v_fulfillment_method = 'pickup' THEN
      -- INSERT pickup: ไม่ต้องเพิ่ม | UPDATE delivery→pickup: ลบออกจาก delivery_trip_items
      IF TG_OP = 'UPDATE' THEN
        SELECT o.delivery_trip_id, o.store_id, dt.status as trip_status INTO v_order_record
        FROM public.orders o
        LEFT JOIN public.delivery_trips dt ON dt.id = o.delivery_trip_id
        WHERE o.id = NEW.order_id;
        IF v_order_record.delivery_trip_id IS NOT NULL AND v_order_record.trip_status <> 'completed' THEN
          DELETE FROM public.delivery_trip_items
          WHERE delivery_trip_store_id IN (
            SELECT dts.id FROM public.delivery_trip_stores dts
            WHERE dts.delivery_trip_id = v_order_record.delivery_trip_id
              AND dts.store_id = v_order_record.store_id
          )
          AND product_id = NEW.product_id
          AND (COALESCE(is_bonus, false) = COALESCE(NEW.is_bonus, false));
        END IF;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  SELECT 
    o.id,
    o.delivery_trip_id,
    o.store_id,
    dt.status as trip_status
  INTO v_order_record
  FROM public.orders o
  LEFT JOIN public.delivery_trips dt ON dt.id = o.delivery_trip_id
  WHERE o.id = v_order_id;

  IF v_order_record IS NULL OR v_order_record.delivery_trip_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_order_record.trip_status = 'completed' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_trip_store_record
  FROM public.delivery_trip_stores
  WHERE delivery_trip_id = v_order_record.delivery_trip_id
    AND store_id = v_order_record.store_id
  LIMIT 1;

  IF v_trip_store_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.delivery_trip_items
    WHERE delivery_trip_id = v_order_record.delivery_trip_id
      AND delivery_trip_store_id = v_trip_store_record.id
      AND product_id = OLD.product_id
      AND (COALESCE(is_bonus, false) = COALESCE(OLD.is_bonus, false));
    RETURN OLD;
  END IF;

  SELECT id, quantity, quantity_picked_up_at_store INTO v_existing_trip_item
  FROM public.delivery_trip_items
  WHERE delivery_trip_id = v_order_record.delivery_trip_id
    AND delivery_trip_store_id = v_trip_store_record.id
    AND product_id = NEW.product_id
    AND (COALESCE(is_bonus, false) = COALESCE(NEW.is_bonus, false))
  LIMIT 1;

  IF v_existing_trip_item IS NULL THEN
    INSERT INTO public.delivery_trip_items (
      delivery_trip_id,
      delivery_trip_store_id,
      product_id,
      quantity,
      quantity_picked_up_at_store,
      notes,
      is_bonus
    ) VALUES (
      v_order_record.delivery_trip_id,
      v_trip_store_record.id,
      NEW.product_id,
      NEW.quantity,
      COALESCE(NEW.quantity_picked_up_at_store, 0),
      NEW.notes,
      COALESCE(NEW.is_bonus, false)
    );
  ELSE
    UPDATE public.delivery_trip_items
    SET 
      quantity = NEW.quantity,
      quantity_picked_up_at_store = LEAST(COALESCE(NEW.quantity_picked_up_at_store, 0), NEW.quantity),
      notes = NEW.notes,
      updated_at = NOW()
    WHERE id = v_existing_trip_item.id;
  END IF;

  UPDATE public.delivery_trips
  SET has_item_changes = true, last_item_change_at = NOW()
  WHERE id = v_order_record.delivery_trip_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- อัปเดต trigger WHEN ให้ fire เมื่อ fulfillment_method เปลี่ยน
DROP TRIGGER IF EXISTS trigger_sync_order_items_to_trip_update ON public.order_items;
CREATE TRIGGER trigger_sync_order_items_to_trip_update
  AFTER UPDATE ON public.order_items
  FOR EACH ROW
  WHEN (
    OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.product_id IS DISTINCT FROM NEW.product_id
    OR OLD.notes IS DISTINCT FROM NEW.notes
    OR OLD.is_bonus IS DISTINCT FROM NEW.is_bonus
    OR OLD.quantity_picked_up_at_store IS DISTINCT FROM NEW.quantity_picked_up_at_store
    OR OLD.fulfillment_method IS DISTINCT FROM NEW.fulfillment_method
  )
  EXECUTE FUNCTION sync_order_items_to_trip();

COMMENT ON FUNCTION sync_order_items_to_trip() IS
'Sync order_items → delivery_trip_items. ข้าม fulfillment_method=pickup. รวม quantity และ quantity_picked_up_at_store สำหรับใบแจ้งหนี้';
