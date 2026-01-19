-- ========================================
-- Cleanup Test Orders
-- Migration: 20260204000003_cleanup_test_orders.sql
-- ========================================
-- ลบข้อมูลทดลองที่สร้างไว้ก่อนหน้านี้
-- ⚠️ คำเตือน: การลบนี้จะลบข้อมูลและไม่สามารถกู้คืนได้!
-- ========================================

-- ========================================
-- Option 1: ลบออเดอร์ทั้งหมด (⚠️ ระวัง!)
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบออเดอร์ทั้งหมดในระบบ (ข้อมูลทดลองทั้งหมด)

-- BEGIN;
-- DELETE FROM public.orders;
-- COMMIT;

-- ========================================
-- Option 2: ลบออเดอร์ตามช่วงวันที่ (แนะนำ)
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบออเดอร์ที่สร้างในช่วงวันที่ระบุ

-- ตัวอย่าง: ลบออเดอร์ที่สร้างก่อนวันที่ 2026-02-04
-- BEGIN;
-- DELETE FROM public.orders
-- WHERE created_at < '2026-02-04'::DATE;
-- COMMIT;

-- ตัวอย่าง: ลบออเดอร์ที่สร้างในช่วงวันที่ระบุ
-- BEGIN;
-- DELETE FROM public.orders
-- WHERE order_date BETWEEN '2026-01-01'::DATE AND '2026-02-03'::DATE;
-- COMMIT;

-- ========================================
-- Option 3: ลบออเดอร์ตาม order_number
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบออเดอร์เฉพาะรายการที่ระบุ

-- ตัวอย่าง: ลบออเดอร์เดียว
-- BEGIN;
-- DELETE FROM public.orders
-- WHERE order_number = 'I0260118001';
-- COMMIT;

-- ตัวอย่าง: ลบหลายออเดอร์พร้อมกัน
-- BEGIN;
-- DELETE FROM public.orders
-- WHERE order_number IN (
--     'I0260118001',
--     'I0260115001',
--     'I0260112001'
-- );
-- COMMIT;

-- ========================================
-- Option 4: ลบออเดอร์ที่ไม่มี order_number
-- ========================================
-- ใช้กรณี: เมื่อต้องการลบออเดอร์ที่ยังไม่มีเลขกำกับ (ข้อมูลทดลองที่สร้างก่อน)

-- BEGIN;
-- DELETE FROM public.orders
-- WHERE order_number IS NULL OR order_number = '';
-- COMMIT;

-- ========================================
-- Option 5: ใช้ Function delete_orders (แนะนำ - ปลอดภัย)
-- ========================================

-- ตัวอย่าง 1: ลบออเดอร์ทั้งหมดที่มีสถานะ 'pending' (ข้อมูลทดลอง)
-- SELECT * FROM public.delete_orders(
--   p_status := 'pending'
-- );

-- ตัวอย่าง 2: ลบออเดอร์ในช่วงวันที่
-- SELECT * FROM public.delete_orders(
--   p_date_from := '2026-01-01'::DATE,
--   p_date_to := '2026-02-03'::DATE
-- );

-- ตัวอย่าง 3: ลบออเดอร์หลายรายการตาม order_number
-- SELECT * FROM public.delete_orders(
--   p_order_numbers := ARRAY[
--     'I0260118001',
--     'I0260115001',
--     'I0260112001'
--   ]
-- );

-- ========================================
-- ตรวจสอบข้อมูลก่อนลบ (แนะนำให้รันก่อนลบ)
-- ========================================

-- ดูจำนวนออเดอร์ทั้งหมด
SELECT 
  COUNT(*) as total_orders,
  COUNT(CASE WHEN order_number IS NULL THEN 1 END) as orders_without_number,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
  MIN(created_at) as earliest_order,
  MAX(created_at) as latest_order
FROM public.orders;

-- ดูออเดอร์ทั้งหมดพร้อมรายละเอียด
SELECT 
  id,
  order_number,
  order_date,
  status,
  total_amount,
  created_at,
  (SELECT customer_name FROM public.stores WHERE id = orders.store_id) as customer_name
FROM public.orders
ORDER BY created_at DESC;

-- ดูออเดอร์ที่ไม่มี order_number
SELECT 
  id,
  order_number,
  order_date,
  status,
  created_at,
  (SELECT customer_name FROM public.stores WHERE id = orders.store_id) as customer_name
FROM public.orders
WHERE order_number IS NULL OR order_number = ''
ORDER BY created_at DESC;

-- ========================================
-- คำแนะนำการใช้งาน
-- ========================================
-- 1. รัน query ตรวจสอบข้อมูลก่อนลบ (Option 5)
-- 2. เลือก Option ที่ต้องการ (1-4) หรือใช้ Function (Option 5)
-- 3. Uncomment คำสั่ง DELETE หรือ SELECT ที่ต้องการ
-- 4. รัน script
-- 5. ตรวจสอบผลลัพธ์
