-- ========================================
-- บันทึกการเบิกสินค้า / รับที่หน้าร้าน (Partial Pickup)
-- Migration: 20260317000000_add_quantity_picked_up_at_store.sql
-- ========================================
-- ปัญหา: ลูกค้าสั่งมาแล้วแต่มาเบิกไปส่วนหนึ่งหรือรับที่หน้าร้านทั้งหมด
--        ระบบเดิมแสดงจำนวนเต็ม → จัดทริป/จัดเรียงผิด
-- แก้ไข: เพิ่ม quantity_picked_up_at_store ใน delivery_trip_items
--        จำนวนที่ต้องจัดส่งจริง = quantity - quantity_picked_up_at_store
-- ========================================

ALTER TABLE public.delivery_trip_items
ADD COLUMN IF NOT EXISTS quantity_picked_up_at_store numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.delivery_trip_items.quantity_picked_up_at_store IS
'จำนวนที่ลูกค้าเบิก/รับไปแล้วที่หน้าร้าน (หน่วย). จำนวนที่ต้องจัดส่งจริง = quantity - quantity_picked_up_at_store';

-- ข้อจำกัด: เบิกได้ไม่เกินที่สั่ง
ALTER TABLE public.delivery_trip_items
ADD CONSTRAINT chk_quantity_picked_up_at_store
CHECK (quantity_picked_up_at_store >= 0 AND quantity_picked_up_at_store <= quantity);

-- Index สำหรับ query ที่กรองรายการที่เหลือจัดส่ง > 0 (ถ้าต้องการ)
-- CREATE INDEX IF NOT EXISTS idx_delivery_trip_items_to_deliver
-- ON public.delivery_trip_items(delivery_trip_id)
-- WHERE (quantity - quantity_picked_up_at_store) > 0;

-- ========================================
-- ปรับ trigger sync: เมื่อ order quantity ลดลง ให้ cap quantity_picked_up_at_store
-- ========================================
CREATE OR REPLACE FUNCTION sync_order_items_to_trip()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_order_record RECORD;
  v_trip_record RECORD;
  v_trip_store_record RECORD;
  v_existing_trip_item RECORD;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

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
      AND product_id = OLD.product_id;
    RETURN OLD;
  END IF;

  SELECT id, quantity, quantity_picked_up_at_store INTO v_existing_trip_item
  FROM public.delivery_trip_items
  WHERE delivery_trip_id = v_order_record.delivery_trip_id
    AND delivery_trip_store_id = v_trip_store_record.id
    AND product_id = NEW.product_id
  LIMIT 1;

  IF v_existing_trip_item IS NULL THEN
    INSERT INTO public.delivery_trip_items (
      delivery_trip_id,
      delivery_trip_store_id,
      product_id,
      quantity,
      quantity_picked_up_at_store,
      notes
    ) VALUES (
      v_order_record.delivery_trip_id,
      v_trip_store_record.id,
      NEW.product_id,
      NEW.quantity,
      0,
      NEW.notes
    );
  ELSE
    -- อัปเดต quantity; ถ้า quantity ลดลง ให้ cap quantity_picked_up_at_store ไม่ให้เกิน quantity ใหม่
    UPDATE public.delivery_trip_items
    SET 
      quantity = NEW.quantity,
      quantity_picked_up_at_store = LEAST(COALESCE(v_existing_trip_item.quantity_picked_up_at_store, 0), NEW.quantity),
      notes = NEW.notes,
      updated_at = NOW()
    WHERE id = v_existing_trip_item.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION sync_order_items_to_trip() IS
'Sync order_items → delivery_trip_items. เมื่อ quantity ลดลง จะ cap quantity_picked_up_at_store ให้ไม่เกิน quantity ใหม่';
