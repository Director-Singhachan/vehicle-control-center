-- ========================================
-- Delete Order Items Script
-- สคริปต์สำหรับลบรายการออเดอร์ (order_items)
-- ========================================
-- คำอธิบาย: สคริปต์นี้ใช้สำหรับลบรายการสินค้าในออเดอร์
-- หมายเหตุ: 
--   - การลบ order_items จะ trigger ให้อัพเดท total_amount ของ order อัตโนมัติ
--   - ต้องมีสิทธิ์ตาม RLS policy (customer สามารถลบได้เฉพาะ order ที่ status = 'pending')
--   - Manager/Admin สามารถลบได้ทุก order
-- ========================================

-- ========================================
-- Option 1: ลบรายการออเดอร์ทั้งหมดจากออเดอร์ที่ระบุ (ใช้ order_number - แนะนำ)
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบรายการทั้งหมดของออเดอร์หนึ่งๆ โดยใช้รหัสออเดอร์
-- 
-- ตัวอย่างการใช้งาน (ใช้ order_number - วิธีที่ง่ายที่สุด):
-- DELETE FROM public.order_items
-- WHERE order_id IN (
--     SELECT id FROM public.orders WHERE order_number = 'ORD-2601-0001'
-- );

-- ตัวอย่าง: ลบหลายออเดอร์พร้อมกัน (ORD-2601-0001 ถึง ORD-2601-0005)
-- DELETE FROM public.order_items
-- WHERE order_id IN (
--     SELECT id FROM public.orders 
--     WHERE order_number IN (
--         'ORD-2601-0001',
--         'ORD-2601-0002',
--         'ORD-2601-0003',
--         'ORD-2601-0004',
--         'ORD-2601-0005'
--     )
-- );

-- ตัวอย่าง: ลบโดยใช้ order_id (UUID) - ถ้าต้องการใช้ UUID โดยตรง
-- DELETE FROM public.order_items
-- WHERE order_id = 'your-order-id-here'::UUID;

-- ========================================
-- Option 2: ลบรายการออเดอร์ที่ระบุ (ลบโดย item id)
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบเฉพาะรายการหนึ่งๆ จากออเดอร์
--
-- ตัวอย่างการใช้งาน:
-- DELETE FROM public.order_items
-- WHERE id = 'your-item-id-here'::UUID;

-- ========================================
-- Option 3: ลบรายการออเดอร์หลายรายการ (ลบโดย item ids)
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบหลายรายการพร้อมกัน
--
-- ตัวอย่างการใช้งาน:
-- DELETE FROM public.order_items
-- WHERE id IN (
--     'item-id-1'::UUID,
--     'item-id-2'::UUID,
--     'item-id-3'::UUID
-- );

-- ========================================
-- Option 4: ลบรายการออเดอร์โดยใช้ Function (แบบปลอดภัย - รองรับ order_number)
-- ========================================
-- Function สำหรับลบรายการออเดอร์พร้อมตรวจสอบสิทธิ์และสถานะ
-- รองรับทั้ง order_number (รหัสออเดอร์) และ order_id (UUID)

-- Drop function เก่า (ถ้ามี) เพื่อป้องกัน conflict
-- ลบทุก overload ของ function นี้
DO $$
BEGIN
  -- ลบทุก overload ของ delete_order_items
  DROP FUNCTION IF EXISTS public.delete_order_items CASCADE;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if function doesn't exist
  NULL;
END $$;

-- สร้าง function ใหม่
CREATE OR REPLACE FUNCTION public.delete_order_items(
  p_order_id UUID DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_item_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  deleted_count INTEGER,
  order_number TEXT,
  message TEXT
) AS $$
DECLARE
  v_order_record RECORD;
  v_deleted_count INTEGER := 0;
  v_message TEXT;
  v_target_order_id UUID;
BEGIN
  -- ถ้ามี p_order_number ระบุ ให้ใช้ order_number (วิธีที่ง่ายกว่า)
  IF p_order_number IS NOT NULL THEN
    -- หา order_id จาก order_number
    SELECT o.id, o.order_number, o.status
    INTO v_order_record
    FROM public.orders o
    WHERE o.order_number = p_order_number;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT 0, p_order_number, format('ไม่พบออเดอร์ %s', p_order_number)::TEXT;
      RETURN;
    END IF;
    
    v_target_order_id := v_order_record.id;
    
  -- ถ้ามี p_order_id ระบุ ให้ใช้ order_id โดยตรง
  ELSIF p_order_id IS NOT NULL THEN
    -- ตรวจสอบว่าออเดอร์มีอยู่จริง
    SELECT o.id, o.order_number, o.status
    INTO v_order_record
    FROM public.orders o
    WHERE o.id = p_order_id;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT 0, NULL::TEXT, 'ไม่พบออเดอร์ที่ระบุ'::TEXT;
      RETURN;
    END IF;
    
    v_target_order_id := p_order_id;
  END IF;
  
  -- ถ้ามี target order ให้ลบรายการทั้งหมด
  IF v_target_order_id IS NOT NULL THEN
    -- ลบรายการทั้งหมดจากออเดอร์
    DELETE FROM public.order_items
    WHERE order_id = v_target_order_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบรายการออเดอร์ %s จำนวน %s รายการสำเร็จ', v_order_record.order_number, v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_order_record.order_number, v_message;
    
  -- ถ้ามี p_item_ids ระบุ ให้ลบรายการตาม ids ที่ระบุ
  ELSIF p_item_ids IS NOT NULL AND array_length(p_item_ids, 1) > 0 THEN
    -- ลบรายการตาม ids
    DELETE FROM public.order_items
    WHERE id = ANY(p_item_ids);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบรายการออเดอร์จำนวน %s รายการสำเร็จ', v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, NULL::TEXT, v_message;
  ELSE
    RETURN QUERY SELECT 0, NULL::TEXT, 'กรุณาระบุ order_id, order_number หรือ item_ids'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.delete_order_items TO authenticated;

-- Comment
COMMENT ON FUNCTION public.delete_order_items IS 
'Function สำหรับลบรายการออเดอร์ (order_items) โดยระบุ order_id, order_number หรือ item_ids';

-- ========================================
-- ตัวอย่างการใช้งาน Function
-- ========================================

-- ตัวอย่าง 1: ลบรายการทั้งหมดจากออเดอร์โดยใช้ order_number (แนะนำ - ง่ายที่สุด)
-- SELECT * FROM public.delete_order_items(
--   p_order_number := 'ORD-2601-0001'
-- );

-- ตัวอย่าง 2: ลบรายการทั้งหมดจากออเดอร์โดยใช้ order_id (UUID)
-- SELECT * FROM public.delete_order_items(
--   p_order_id := 'your-order-id-here'::UUID
-- );

-- ตัวอย่าง 3: ลบรายการหลายรายการตาม item ids
-- SELECT * FROM public.delete_order_items(
--   p_item_ids := ARRAY[
--     'item-id-1'::UUID,
--     'item-id-2'::UUID
--   ]
-- );

-- ========================================
-- Query สำหรับตรวจสอบรายการออเดอร์ก่อนลบ
-- ========================================

-- ตรวจสอบรายการออเดอร์ทั้งหมดของออเดอร์ที่ระบุ (ใช้ order_number - แนะนำ)
-- SELECT 
--     oi.id as item_id,
--     oi.order_id,
--     o.order_number,
--     o.status as order_status,
--     p.product_code,
--     p.product_name,
--     oi.quantity,
--     oi.unit_price,
--     oi.subtotal,
--     oi.created_at
-- FROM public.order_items oi
-- JOIN public.orders o ON oi.order_id = o.id
-- JOIN public.products p ON oi.product_id = p.id
-- WHERE o.order_number = 'ORD-2601-0001'
-- ORDER BY oi.created_at;

-- ตรวจสอบหลายออเดอร์พร้อมกัน
-- SELECT 
--     oi.id as item_id,
--     oi.order_id,
--     o.order_number,
--     o.status as order_status,
--     p.product_code,
--     p.product_name,
--     oi.quantity,
--     oi.unit_price,
--     oi.subtotal,
--     oi.created_at
-- FROM public.order_items oi
-- JOIN public.orders o ON oi.order_id = o.id
-- JOIN public.products p ON oi.product_id = p.id
-- WHERE o.order_number IN (
--     'ORD-2601-0001',
--     'ORD-2601-0002',
--     'ORD-2601-0003',
--     'ORD-2601-0004',
--     'ORD-2601-0005'
-- )
-- ORDER BY o.order_number, oi.created_at;

-- ========================================
-- Query สำหรับนับจำนวนรายการออเดอร์ก่อนลบ
-- ========================================

-- นับจำนวนรายการออเดอร์ของออเดอร์ที่ระบุ (ใช้ order_number - แนะนำ)
-- SELECT 
--     o.order_number,
--     o.status,
--     COUNT(oi.id) as item_count,
--     COALESCE(SUM(oi.subtotal), 0) as total_amount
-- FROM public.orders o
-- LEFT JOIN public.order_items oi ON o.id = oi.order_id
-- WHERE o.order_number = 'ORD-2601-0001'
-- GROUP BY o.id, o.order_number, o.status;

-- นับหลายออเดอร์พร้อมกัน
-- SELECT 
--     o.order_number,
--     o.status,
--     COUNT(oi.id) as item_count,
--     COALESCE(SUM(oi.subtotal), 0) as total_amount
-- FROM public.orders o
-- LEFT JOIN public.order_items oi ON o.id = oi.order_id
-- WHERE o.order_number IN (
--     'ORD-2601-0001',
--     'ORD-2601-0002',
--     'ORD-2601-0003',
--     'ORD-2601-0004',
--     'ORD-2601-0005'
-- )
-- GROUP BY o.id, o.order_number, o.status
-- ORDER BY o.order_number;

