-- ========================================
-- Auto Sync Order Items to Delivery Trip Items
-- Migration: 20260205000001_sync_order_to_trip_trigger.sql
-- ========================================
-- สร้าง database trigger เพื่อ sync ออเดอร์ไปยังทริปอัตโนมัติ
-- เมื่อแก้ไข order_items ระบบจะ sync ไปยัง delivery_trip_items อัตโนมัติ
-- ========================================

-- Function สำหรับ sync order items ไปยัง delivery_trip_items
CREATE OR REPLACE FUNCTION sync_order_items_to_trip()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_order_record RECORD;
  v_trip_record RECORD;
  v_trip_store_record RECORD;
  v_existing_trip_item RECORD;
BEGIN
  -- ใช้ order_id จาก NEW หรือ OLD
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  -- หาออเดอร์และทริปที่เกี่ยวข้อง
  SELECT 
    o.id,
    o.delivery_trip_id,
    o.store_id,
    dt.status as trip_status
  INTO v_order_record
  FROM public.orders o
  LEFT JOIN public.delivery_trips dt ON dt.id = o.delivery_trip_id
  WHERE o.id = v_order_id;

  -- ถ้าไม่มีออเดอร์หรือไม่มีทริป ไม่ต้อง sync
  IF v_order_record IS NULL OR v_order_record.delivery_trip_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- ถ้าทริป completed แล้ว ไม่ sync (เพราะอาจมีการแก้ไขตามสถานการณ์จริง)
  IF v_order_record.trip_status = 'completed' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- หา delivery_trip_store ที่เกี่ยวข้อง
  SELECT id INTO v_trip_store_record
  FROM public.delivery_trip_stores
  WHERE delivery_trip_id = v_order_record.delivery_trip_id
    AND store_id = v_order_record.store_id
  LIMIT 1;

  -- ถ้าไม่พบ trip store ไม่ต้อง sync
  IF v_trip_store_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- ถ้าเป็นการลบ (TG_OP = 'DELETE')
  IF TG_OP = 'DELETE' THEN
    -- ลบ delivery_trip_item ที่มี product_id เดียวกัน
    DELETE FROM public.delivery_trip_items
    WHERE delivery_trip_id = v_order_record.delivery_trip_id
      AND delivery_trip_store_id = v_trip_store_record.id
      AND product_id = OLD.product_id;
    
    RETURN OLD;
  END IF;

  -- ถ้าเป็นการ INSERT หรือ UPDATE
  -- หา delivery_trip_item ที่มี product_id เดียวกัน
  SELECT id, quantity INTO v_existing_trip_item
  FROM public.delivery_trip_items
  WHERE delivery_trip_id = v_order_record.delivery_trip_id
    AND delivery_trip_store_id = v_trip_store_record.id
    AND product_id = NEW.product_id
  LIMIT 1;

  IF v_existing_trip_item IS NULL THEN
    -- ไม่มี trip item → เพิ่มใหม่
    INSERT INTO public.delivery_trip_items (
      delivery_trip_id,
      delivery_trip_store_id,
      product_id,
      quantity,
      notes
    ) VALUES (
      v_order_record.delivery_trip_id,
      v_trip_store_record.id,
      NEW.product_id,
      NEW.quantity,
      NEW.notes
    );
  ELSE
    -- มี trip item → อัพเดท quantity
    IF v_existing_trip_item.quantity IS DISTINCT FROM NEW.quantity THEN
      UPDATE public.delivery_trip_items
      SET 
        quantity = NEW.quantity,
        notes = NEW.notes,
        updated_at = NOW()
      WHERE id = v_existing_trip_item.id;
    END IF;
  END IF;

  -- Mark trip as having item changes
  UPDATE public.delivery_trips
  SET 
    has_item_changes = true,
    last_item_change_at = NOW()
  WHERE id = v_order_record.delivery_trip_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- สร้าง triggers สำหรับ INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trigger_sync_order_items_to_trip_insert ON public.order_items;
DROP TRIGGER IF EXISTS trigger_sync_order_items_to_trip_update ON public.order_items;
DROP TRIGGER IF EXISTS trigger_sync_order_items_to_trip_delete ON public.order_items;

-- Trigger สำหรับ INSERT
CREATE TRIGGER trigger_sync_order_items_to_trip_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_items_to_trip();

-- Trigger สำหรับ UPDATE
CREATE TRIGGER trigger_sync_order_items_to_trip_update
  AFTER UPDATE ON public.order_items
  FOR EACH ROW
  WHEN (
    -- Sync เฉพาะเมื่อมีการเปลี่ยนแปลง quantity, product_id, หรือ notes
    OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.product_id IS DISTINCT FROM NEW.product_id
    OR OLD.notes IS DISTINCT FROM NEW.notes
  )
  EXECUTE FUNCTION sync_order_items_to_trip();

-- Trigger สำหรับ DELETE
CREATE TRIGGER trigger_sync_order_items_to_trip_delete
  AFTER DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_items_to_trip();

-- Comment
COMMENT ON FUNCTION sync_order_items_to_trip() IS 
  'Sync order_items ไปยัง delivery_trip_items อัตโนมัติเมื่อมีการแก้ไข order_items (ทำงานใน database backend)';

-- ========================================
-- หมายเหตุ
-- ========================================
-- 1. Trigger นี้ทำงานใน database backend อัตโนมัติ
-- 2. Sync เฉพาะทริปที่ยังไม่ completed
-- 3. Sync เฉพาะออเดอร์ที่ถูกกำหนดทริปแล้ว (delivery_trip_id IS NOT NULL)
-- 4. ถ้า product_id เปลี่ยน จะลบของเก่าและเพิ่มของใหม่
-- 5. ถ้า quantity เปลี่ยน จะอัพเดท delivery_trip_items
-- 6. ถ้าลบ order_item จะลบ delivery_trip_item ที่เกี่ยวข้องด้วย
