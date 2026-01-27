-- Auto-populate stores.branch from existing orders
-- Date: 2026-01-27
-- Purpose: ใช้ข้อมูล branch จาก orders ที่มีอยู่แล้ว (ที่ฝ่ายขายกำหนดตอนสร้าง) 
--          เพื่ออัพเดท stores.branch อัตโนมัติ

-- ========================================
-- 1. อัพเดท stores.branch จาก orders ที่มีอยู่
-- ========================================

-- Strategy: ดู order ล่าสุดของแต่ละ store แล้วเอา branch มาใช้
-- เพราะส่วนใหญ่ลูกค้าจะอยู่สาขาเดิมตลอด

UPDATE public.stores s
SET branch = (
  SELECT o.branch
  FROM public.orders o
  WHERE o.store_id = s.id
    AND o.branch IS NOT NULL
  ORDER BY o.created_at DESC
  LIMIT 1
)
WHERE s.branch IS NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.store_id = s.id 
      AND o.branch IS NOT NULL
  );

-- ========================================
-- 2. สำหรับลูกค้าที่ยังไม่มี orders หรือ orders ไม่มี branch
--    ให้ดูจาก user ที่สร้างลูกค้า
-- ========================================

UPDATE public.stores s
SET branch = (
  SELECT p.branch
  FROM public.profiles p
  WHERE p.id = s.created_by
    AND p.branch IS NOT NULL
  LIMIT 1
)
WHERE s.branch IS NULL
  AND s.created_by IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = s.created_by 
      AND p.branch IS NOT NULL
  );

-- ========================================
-- 3. สำหรับลูกค้าที่ยังไม่มี branch เลย ให้ default เป็น HQ
-- ========================================

UPDATE public.stores
SET branch = 'HQ'
WHERE branch IS NULL;

-- ========================================
-- 4. รายงาน: แสดงจำนวนลูกค้าแต่ละสาขา
-- ========================================

SELECT 
  branch as "สาขา",
  COUNT(*) as "จำนวนลูกค้า"
FROM public.stores
WHERE is_active = true
GROUP BY branch
ORDER BY branch;

-- ========================================
-- 5. รายงานละเอียด: ลูกค้าที่ได้ branch จาก source ไหน
-- ========================================

WITH store_branch_source AS (
  SELECT 
    s.id,
    s.customer_code,
    s.customer_name,
    s.branch,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.store_id = s.id AND o.branch IS NOT NULL
      ) THEN 'จาก Orders'
      WHEN s.created_by IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = s.created_by AND p.branch IS NOT NULL
      ) THEN 'จาก User ที่สร้าง'
      ELSE 'Default (HQ)'
    END as branch_source,
    (SELECT COUNT(*) FROM public.orders WHERE store_id = s.id) as order_count
  FROM public.stores s
  WHERE s.is_active = true
)
SELECT 
  branch as "สาขา",
  branch_source as "ที่มาของ Branch",
  COUNT(*) as "จำนวนลูกค้า",
  ROUND(AVG(order_count), 1) as "ค่าเฉลี่ยจำนวน Orders"
FROM store_branch_source
GROUP BY branch, branch_source
ORDER BY branch, branch_source;

-- ========================================
-- 6. ตรวจสอบลูกค้าที่มี orders หลายสาขา (ควรตรวจสอบ)
-- ========================================

SELECT 
  s.customer_code,
  s.customer_name,
  s.branch as store_branch,
  COUNT(DISTINCT o.branch) as branch_count,
  STRING_AGG(DISTINCT o.branch, ', ') as order_branches,
  COUNT(o.id) as total_orders
FROM public.stores s
JOIN public.orders o ON o.store_id = s.id
WHERE o.branch IS NOT NULL
GROUP BY s.id, s.customer_code, s.customer_name, s.branch
HAVING COUNT(DISTINCT o.branch) > 1
ORDER BY branch_count DESC, total_orders DESC;

-- ========================================
-- 7. แสดงตัวอย่างลูกค้าแต่ละสาขา (20 รายแรก)
-- ========================================

SELECT 
  branch as "สาขา",
  customer_code as "รหัสลูกค้า",
  customer_name as "ชื่อลูกค้า",
  (SELECT COUNT(*) FROM public.orders WHERE store_id = stores.id) as "จำนวน Orders"
FROM public.stores
WHERE is_active = true
  AND branch IS NOT NULL
ORDER BY branch, customer_code
LIMIT 20;

-- ========================================
-- COMMENT
-- ========================================

COMMENT ON COLUMN public.stores.branch IS 
  'สาขาของลูกค้า (HQ = สำนักงานใหญ่, SD = สาขาสอยดาว) - Auto-populated จาก orders ที่มีอยู่';
