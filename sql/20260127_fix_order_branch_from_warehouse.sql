-- Fix existing orders to have correct branch from warehouse
-- Date: 2026-01-27
-- Purpose: อัพเดท orders.branch ให้ตรงกับ warehouse.branch และแก้ trigger conflict

-- ========================================
-- 1. อัพเดท orders ที่มีอยู่แล้วให้ branch ถูกต้อง
-- ========================================

-- อัพเดทจาก warehouse (priority 1)
UPDATE public.orders o
SET branch = w.branch
FROM public.warehouses w
WHERE o.warehouse_id = w.id
  AND w.branch IS NOT NULL
  AND (o.branch IS NULL OR o.branch != w.branch);

-- อัพเดทจาก store (priority 2 - ถ้าไม่มี warehouse)
UPDATE public.orders o
SET branch = s.branch
FROM public.stores s
WHERE o.store_id = s.id
  AND o.warehouse_id IS NULL
  AND s.branch IS NOT NULL
  AND (o.branch IS NULL OR o.branch != s.branch);

-- อัพเดทจาก user (priority 3 - ถ้าไม่มีทั้งสอง)
UPDATE public.orders o
SET branch = p.branch
FROM public.profiles p
WHERE o.created_by = p.id
  AND o.warehouse_id IS NULL
  AND o.store_id IS NULL
  AND p.branch IS NOT NULL
  AND (o.branch IS NULL OR o.branch != p.branch);

-- Default HQ สำหรับ orders ที่ยังไม่มี branch
UPDATE public.orders
SET branch = 'HQ'
WHERE branch IS NULL;

-- ========================================
-- 2. ลบ trigger เก่าที่อาจขัดแย้ง
-- ========================================

-- ลบ trigger set_order_branch ที่อาจถูก override
DROP TRIGGER IF EXISTS trigger_set_order_branch ON public.orders;

-- ========================================
-- 3. สร้าง trigger ใหม่ที่รัน AFTER เพื่อไม่โดน override
-- ========================================

-- Function ใหม่ที่รัน AFTER INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.update_order_branch_after()
RETURNS TRIGGER AS $$
DECLARE
  new_branch TEXT;
BEGIN
  -- ดึง branch ตามลำดับ priority
  -- 1. จาก warehouse
  IF NEW.warehouse_id IS NOT NULL THEN
    SELECT branch INTO new_branch
    FROM public.warehouses
    WHERE id = NEW.warehouse_id;
  END IF;
  
  -- 2. จาก store (ถ้าไม่มี warehouse)
  IF new_branch IS NULL AND NEW.store_id IS NOT NULL THEN
    SELECT branch INTO new_branch
    FROM public.stores
    WHERE id = NEW.store_id;
  END IF;
  
  -- 3. จาก user (ถ้าไม่มีทั้งสอง)
  IF new_branch IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT branch INTO new_branch
    FROM public.profiles
    WHERE id = NEW.created_by;
  END IF;
  
  -- 4. Default to HQ
  IF new_branch IS NULL THEN
    new_branch := 'HQ';
  END IF;
  
  -- Normalize branch
  new_branch := CASE
    WHEN new_branch ILIKE '%สอยดาว%' OR new_branch = 'SD' THEN 'SD'
    WHEN new_branch ILIKE '%สำนักงาน%' OR new_branch = 'HQ' OR new_branch IS NULL THEN 'HQ'
    ELSE 'HQ'
  END;
  
  -- อัพเดท branch ถ้าค่าไม่ตรงกัน
  IF NEW.branch IS DISTINCT FROM new_branch THEN
    UPDATE public.orders
    SET branch = new_branch
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger ใหม่ที่รัน AFTER (ไม่โดน override)
CREATE TRIGGER trigger_update_order_branch_after
  AFTER INSERT OR UPDATE OF warehouse_id, store_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_branch_after();

-- ========================================
-- 4. ตรวจสอบผลลัพธ์
-- ========================================

SELECT 
  'Orders with warehouse' as category,
  COUNT(*) FILTER (WHERE o.branch = w.branch) as correct_count,
  COUNT(*) FILTER (WHERE o.branch != w.branch) as wrong_count,
  COUNT(*) as total
FROM public.orders o
JOIN public.warehouses w ON o.warehouse_id = w.id

UNION ALL

SELECT 
  'Orders without warehouse' as category,
  COUNT(*) FILTER (WHERE o.branch = COALESCE(s.branch, p.branch, 'HQ')) as correct_count,
  COUNT(*) FILTER (WHERE o.branch != COALESCE(s.branch, p.branch, 'HQ')) as wrong_count,
  COUNT(*) as total
FROM public.orders o
LEFT JOIN public.stores s ON o.store_id = s.id
LEFT JOIN public.profiles p ON o.created_by = p.id
WHERE o.warehouse_id IS NULL;

-- ========================================
-- 5. แสดง orders ล่าสุดเพื่อตรวจสอบ
-- ========================================

SELECT 
  o.id,
  o.order_number,
  o.branch as order_branch,
  w.name as warehouse_name,
  w.branch as warehouse_branch,
  s.customer_name,
  p.full_name as created_by,
  CASE
    WHEN o.warehouse_id IS NOT NULL THEN 
      CASE WHEN o.branch = w.branch THEN '✅ ถูกต้อง' ELSE '❌ ผิด' END
    ELSE '(ไม่มี warehouse)'
  END as status
FROM public.orders o
LEFT JOIN public.warehouses w ON o.warehouse_id = w.id
LEFT JOIN public.stores s ON o.store_id = s.id
LEFT JOIN public.profiles p ON o.created_by = p.id
WHERE o.warehouse_id IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 20;
