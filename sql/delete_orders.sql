-- ========================================
-- Delete Orders Script
-- สคริปต์สำหรับลบออเดอร์ทั้งหมด
-- ========================================
-- คำอธิบาย: สคริปต์นี้ใช้สำหรับลบออเดอร์ทั้งหมด
-- หมายเหตุ: 
--   - การลบ orders จะลบ order_items และ order_status_history อัตโนมัติ (CASCADE)
--   - ต้องมีสิทธิ์ตาม RLS policy (Manager/Admin เท่านั้นที่ลบได้)
--   - ⚠️ คำเตือน: การลบนี้จะลบข้อมูลทั้งหมดและไม่สามารถกู้คืนได้!
-- ========================================

-- ========================================
-- Option 1: ลบออเดอร์ทั้งหมด (⚠️ ระวัง!)
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบออเดอร์ทั้งหมดในระบบ
-- ⚠️ คำเตือน: การลบนี้จะลบข้อมูลทั้งหมดและไม่สามารถกู้คืนได้!

-- DELETE FROM public.orders;

-- ========================================
-- Option 2: ลบออเดอร์ตามรหัสออเดอร์ (order_number) - แนะนำ
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบออเดอร์เฉพาะรายการที่ระบุ

-- ⚠️ หมายเหตุ: คำสั่ง DELETE ด้านล่างจะลบออเดอร์ทันทีเมื่อรัน script นี้
-- ถ้าต้องการลบเฉพาะออเดอร์ที่ระบุ ให้ uncomment คำสั่งที่ต้องการ
-- ถ้าไม่ต้องการลบอะไรตอนนี้ ให้ comment ทุกคำสั่ง DELETE

BEGIN;

-- ตัวอย่าง: ลบออเดอร์เดียว
-- DELETE FROM public.orders
-- WHERE order_number = 'ORD-2601-0001';

-- ตัวอย่าง: ลบหลายออเดอร์พร้อมกัน (ORD-2601-0001 ถึง ORD-2601-0005)
DELETE FROM public.orders
WHERE order_number IN (
    'ORD-2601-0001',
    'ORD-2601-0002',
    'ORD-2601-0003',
    'ORD-2601-0004',
    'ORD-2601-0005'
);

COMMIT;

-- ========================================
-- Option 3: ลบออเดอร์ตาม order_id (UUID)
-- ========================================
-- ใช้กรณี: เมื่อทราบ UUID ของออเดอร์

-- ตัวอย่าง: ลบออเดอร์เดียว
-- DELETE FROM public.orders
-- WHERE id = 'your-order-id-here'::UUID;

-- ตัวอย่าง: ลบหลายออเดอร์พร้อมกัน
-- DELETE FROM public.orders
-- WHERE id IN (
--     'uuid-1'::UUID,
--     'uuid-2'::UUID,
--     'uuid-3'::UUID
-- );

-- ========================================
-- Option 4: ลบออเดอร์ตามเงื่อนไข
-- ========================================

-- ลบออเดอร์ที่มีสถานะเป็น 'pending'
-- DELETE FROM public.orders
-- WHERE status = 'pending';

-- ลบออเดอร์ที่สร้างในวันที่ระบุ
-- DELETE FROM public.orders
-- WHERE order_date = '2026-01-26'::DATE;

-- ลบออเดอร์ที่สร้างในช่วงวันที่ระบุ
-- DELETE FROM public.orders
-- WHERE order_date BETWEEN '2026-01-01'::DATE AND '2026-01-26'::DATE;

-- ========================================
-- Option 5: ลบออเดอร์โดยใช้ Function (แบบปลอดภัย)
-- ========================================
-- Function สำหรับลบออเดอร์พร้อมตรวจสอบสิทธิ์และสถานะ

-- Drop function เก่า (ถ้ามี) เพื่อป้องกัน conflict
DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.delete_orders CASCADE;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- สร้าง function ใหม่
CREATE OR REPLACE FUNCTION public.delete_orders(
  p_order_number TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_order_numbers TEXT[] DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  deleted_count INTEGER,
  message TEXT
) AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_message TEXT;
BEGIN
  -- ลบตาม order_number เดียว
  IF p_order_number IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE order_number = p_order_number;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ %s สำเร็จ', p_order_number);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบตาม order_id
  ELSIF p_order_id IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE id = p_order_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ (ID: %s) สำเร็จ', p_order_id);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบหลายออเดอร์ตาม order_numbers
  ELSIF p_order_numbers IS NOT NULL AND array_length(p_order_numbers, 1) > 0 THEN
    DELETE FROM public.orders
    WHERE order_number = ANY(p_order_numbers);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์จำนวน %s รายการสำเร็จ', v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบตาม status
  ELSIF p_status IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE status = p_status;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ที่มีสถานะ %s จำนวน %s รายการสำเร็จ', p_status, v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบตามช่วงวันที่
  ELSIF p_date_from IS NOT NULL AND p_date_to IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE order_date BETWEEN p_date_from AND p_date_to;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ระหว่าง %s ถึง %s จำนวน %s รายการสำเร็จ', p_date_from, p_date_to, v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  ELSE
    RETURN QUERY SELECT 0, 'กรุณาระบุเงื่อนไขในการลบออเดอร์'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.delete_orders TO authenticated;

-- Comment
COMMENT ON FUNCTION public.delete_orders IS 
'Function สำหรับลบออเดอร์ (orders) พร้อม order_items และ order_status_history ที่เกี่ยวข้อง (CASCADE)';

-- ========================================
-- ตัวอย่างการใช้งาน Function
-- ========================================

-- ตัวอย่าง 1: ลบออเดอร์เดียวโดยใช้ order_number
-- SELECT * FROM public.delete_orders(
--   p_order_number := 'ORD-2601-0001'
-- );

-- ตัวอย่าง 2: ลบหลายออเดอร์พร้อมกัน
-- SELECT * FROM public.delete_orders(
--   p_order_numbers := ARRAY[
--     'ORD-2601-0001',
--     'ORD-2601-0002',
--     'ORD-2601-0003',
--     'ORD-2601-0004',
--     'ORD-2601-0005'
--   ]
-- );

-- ตัวอย่าง 3: ลบออเดอร์ทั้งหมดที่มีสถานะ 'pending'
-- SELECT * FROM public.delete_orders(
--   p_status := 'pending'
-- );

-- ตัวอย่าง 4: ลบออเดอร์ในช่วงวันที่
-- SELECT * FROM public.delete_orders(
--   p_date_from := '2026-01-01'::DATE,
--   p_date_to := '2026-01-26'::DATE
-- );

-- ========================================
-- Query สำหรับตรวจสอบออเดอร์ก่อนลบ
-- ========================================

-- ตรวจสอบออเดอร์ทั้งหมด
-- SELECT 
--     order_number,
--     status,
--     order_date,
--     delivery_date,
--     total_amount,
--     created_at
-- FROM public.orders
-- ORDER BY created_at DESC;

-- ตรวจสอบออเดอร์ที่ระบุ
-- SELECT 
--     o.order_number,
--     o.status,
--     o.order_date,
--     o.delivery_date,
--     o.total_amount,
--     COUNT(oi.id) as item_count,
--     o.created_at
-- FROM public.orders o
-- LEFT JOIN public.order_items oi ON o.id = oi.order_id
-- WHERE o.order_number IN (
--     'ORD-2601-0001',
--     'ORD-2601-0002',
--     'ORD-2601-0003',
--     'ORD-2601-0004',
--     'ORD-2601-0005'
-- )
-- GROUP BY o.id, o.order_number, o.status, o.order_date, o.delivery_date, o.total_amount, o.created_at
-- ORDER BY o.order_number;

-- นับจำนวนออเดอร์ทั้งหมด
-- SELECT 
--     COUNT(*) as total_orders,
--     COUNT(DISTINCT status) as status_count,
--     SUM(total_amount) as total_amount_sum
-- FROM public.orders;

-- นับจำนวนออเดอร์ตามสถานะ
-- SELECT 
--     status,
--     COUNT(*) as count,
--     SUM(total_amount) as total_amount
-- FROM public.orders
-- GROUP BY status
-- ORDER BY count DESC;

