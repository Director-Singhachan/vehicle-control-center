-- Fix order_number generation to create only when assigned to trip
-- Date: 2026-01-27
-- Purpose: แก้ไข order_number ให้ถูกสร้างเมื่อ order ถูก assign ให้กับ trip แล้ว
--          ไม่ใช่สร้างทันทีตอนสร้าง order

-- ========================================
-- 1. ปิด trigger เดิมที่สร้าง order_number ทันที
-- ========================================

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;

-- ========================================
-- 2. สร้าง function ใหม่ที่สร้าง order_number เมื่อ assign trip
-- ========================================

CREATE OR REPLACE FUNCTION public.generate_order_number_on_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
  branch_code TEXT;
  current_year_month TEXT;
  max_number INT;
BEGIN
  -- สร้าง order_number เฉพาะเมื่อ:
  -- 1. order_number ยังเป็น NULL
  -- 2. delivery_trip_id ถูก assign (ไม่ใช่ NULL)
  
  IF NEW.order_number IS NULL AND NEW.delivery_trip_id IS NOT NULL THEN
    -- Ensure branch is set first
    IF NEW.branch IS NULL THEN
      -- Try to get from store
      SELECT branch INTO NEW.branch
      FROM public.stores
      WHERE id = NEW.store_id;
      
      -- If store doesn't have branch, try from user
      IF NEW.branch IS NULL THEN
        SELECT branch INTO NEW.branch
        FROM public.profiles
        WHERE id = NEW.created_by;
      END IF;
      
      -- Default to HQ
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
    
    branch_code := NEW.branch;
    current_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
    
    -- Find max order number for this branch and month
    SELECT COALESCE(
      MAX(
        CASE
          WHEN order_number ~ ('^' || branch_code || '-ORD-' || current_year_month || '-[0-9]{4}$')
          THEN CAST(SUBSTRING(order_number FROM LENGTH(branch_code) + 10) AS INTEGER)
          ELSE 0
        END
      ),
      0
    ) INTO max_number
    FROM public.orders
    WHERE branch = branch_code
      AND order_number LIKE (branch_code || '-ORD-' || current_year_month || '-%');
    
    -- Generate: BRANCH-ORD-YYMM-XXXX (e.g., HQ-ORD-2601-0001)
    NEW.order_number := branch_code || '-ORD-' || current_year_month || '-' || LPAD((max_number + 1)::TEXT, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. สร้าง trigger ใหม่ที่ทำงานเมื่อ UPDATE
-- ========================================

DROP TRIGGER IF EXISTS trigger_generate_order_number_on_trip_assignment ON public.orders;

CREATE TRIGGER trigger_generate_order_number_on_trip_assignment
  BEFORE INSERT OR UPDATE OF delivery_trip_id ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL AND NEW.delivery_trip_id IS NOT NULL)
  EXECUTE FUNCTION public.generate_order_number_on_trip_assignment();

-- ========================================
-- 4. ทดสอบ: แสดง orders ที่ยังไม่มี order_number
-- ========================================

SELECT 
  o.id,
  o.order_number,
  o.delivery_trip_id,
  o.status,
  o.branch,
  o.created_at,
  s.customer_name
FROM public.orders o
LEFT JOIN public.stores s ON o.store_id = s.id
WHERE o.order_number IS NULL
ORDER BY o.created_at DESC
LIMIT 20;

-- ========================================
-- 5. COMMENT
-- ========================================

COMMENT ON FUNCTION public.generate_order_number_on_trip_assignment() IS 
  'สร้าง order_number เมื่อ order ถูก assign ให้กับ trip (delivery_trip_id != NULL) แทนที่จะสร้างทันที';

-- ========================================
-- หมายเหตุ
-- ========================================
-- จากนี้ไป:
-- - สร้าง order ใหม่ → order_number = NULL
-- - Assign order ให้กับ trip → order_number ถูกสร้างอัตโนมัติ
-- - Branch ถูกกำหนดจากฝ่ายขายตอนสร้าง order (ไม่ต้องกำหนดใน stores)
