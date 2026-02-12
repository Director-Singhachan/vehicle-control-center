-- Add branch support to warehouses
-- Date: 2026-01-27
-- Purpose: เพิ่ม branch column ให้ warehouses เพื่อให้ orders ดึง branch จาก warehouse ที่เลือก

-- ========================================
-- 1. เพิ่ม branch column ให้ warehouses
-- ========================================

ALTER TABLE public.warehouses
ADD COLUMN IF NOT EXISTS branch TEXT;

CREATE INDEX IF NOT EXISTS idx_warehouses_branch
  ON public.warehouses(branch);

COMMENT ON COLUMN public.warehouses.branch IS 'สาขาของคลังสินค้า (HQ = สำนักงานใหญ่, SD = สาขาสอยดาว)';

-- ========================================
-- 2. กำหนด branch ให้คลังที่มีอยู่แล้ว
-- ========================================

-- คลังหลัก = HQ
UPDATE public.warehouses
SET branch = 'HQ'
WHERE type = 'main'
  OR code LIKE '%MAIN%'
  OR code LIKE '%HQ%';

-- คลังที่มี "สอยดาว" ในชื่อ = SD
UPDATE public.warehouses
SET branch = 'SD'
WHERE name ILIKE '%สอยดาว%'
  OR code ILIKE '%SD%'
  OR code ILIKE '%สอย%';

-- คลังที่ยังไม่มี branch = HQ (default)
UPDATE public.warehouses
SET branch = 'HQ'
WHERE branch IS NULL;

-- ========================================
-- 3. เพิ่ม warehouse_id column ให้ orders (ถ้ายังไม่มี)
-- ========================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_warehouse_id
  ON public.orders(warehouse_id);

COMMENT ON COLUMN public.orders.warehouse_id IS 'คลังสินค้าที่เลือกตอนสร้างออเดอร์';

-- ========================================
-- 4. อัพเดท trigger เพื่อดึง branch จาก warehouse (ถ้ามี)
-- ========================================

CREATE OR REPLACE FUNCTION public.set_order_branch()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้ายังไม่มี branch ให้ดึงจาก warehouse ที่เลือกก่อน
  IF NEW.branch IS NULL THEN
    -- 1. ลองดึงจาก warehouse
    IF NEW.warehouse_id IS NOT NULL THEN
      SELECT branch INTO NEW.branch
      FROM public.warehouses
      WHERE id = NEW.warehouse_id;
    END IF;
    
    -- 2. ถ้ายังไม่มี ลองจาก store
    IF NEW.branch IS NULL AND NEW.store_id IS NOT NULL THEN
      SELECT branch INTO NEW.branch
      FROM public.stores
      WHERE id = NEW.store_id;
    END IF;
   
    -- 3. ถ้ายังไม่มี ลองจาก user ที่สร้าง
    IF NEW.branch IS NULL AND NEW.created_by IS NOT NULL THEN
      SELECT branch INTO NEW.branch
      FROM public.profiles
      WHERE id = NEW.created_by;
    END IF;
    
    -- 4. Default to HQ
    IF NEW.branch IS NULL THEN
      NEW.branch := 'HQ';
    END IF;
  END IF;
  
  -- Normalize branch to code (in case it's Thai name)
  NEW.branch := CASE
    WHEN NEW.branch ILIKE '%สอยดาว%' OR NEW.branch = 'SD' THEN 'SD'
    WHEN NEW.branch ILIKE '%สำนักงาน%' OR NEW.branch = 'HQ' OR NEW.branch IS NULL THEN 'HQ'
    ELSE 'HQ'
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. รายงาน: แสดงคลังแต่ละสาขา
-- ========================================

SELECT 
  branch as "สาขา",
  code as "รหัสคลัง",
  name as "ชื่อคลัง",
  type as "ประเภท",
  is_active as "ใช้งาน"
FROM public.warehouses
ORDER BY branch, type, code;

-- ========================================
-- 6. ทดสอบ: แสดง orders ว่าดึง branch จากไหน
-- ========================================

SELECT 
  o.id,
  o.order_number,
  o.branch as order_branch,
  w.name as warehouse_name,
  w.branch as warehouse_branch,
  s.customer_name,
  s.branch as store_branch,
  p.full_name as created_by,
  p.branch as user_branch,
  CASE
    WHEN o.warehouse_id IS NOT NULL THEN 'จาก Warehouse'
    WHEN s.branch IS NOT NULL THEN 'จาก Store'
    WHEN p.branch IS NOT NULL THEN 'จาก User'
    ELSE 'Default (HQ)'
  END as branch_source
FROM public.orders o
LEFT JOIN public.warehouses w ON o.warehouse_id = w.id
LEFT JOIN public.stores s ON o.store_id = s.id
LEFT JOIN public.profiles p ON o.created_by = p.id
ORDER BY o.created_at DESC
LIMIT 20;
