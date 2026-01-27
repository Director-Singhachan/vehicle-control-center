-- Fix order number generation with simpler and more robust logic
-- Date: 2026-01-27
-- Purpose: แก้ไข logic การสร้าง order_number ให้ robust และป้องกัน 0000

-- ========================================
-- สร้าง function ใหม่ที่ robust กว่าเดิม
-- ========================================

CREATE OR REPLACE FUNCTION public.generate_order_number_on_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
  branch_code TEXT;
  current_year_month TEXT;
  max_number INT;
  lock_key BIGINT;
  branch_hash INT;
  order_prefix TEXT;
BEGIN
  -- สร้าง order_number เฉพาะเมื่อ:
  -- 1. order_number ยังเป็น NULL
  -- 2. delivery_trip_id ถูก assign (ไม่ใช่ NULL)
  
  IF NEW.order_number IS NULL AND NEW.delivery_trip_id IS NOT NULL THEN
    -- Ensure branch is set first
    IF NEW.branch IS NULL THEN
      -- Try to get from warehouse
      IF NEW.warehouse_id IS NOT NULL THEN
        SELECT branch INTO NEW.branch
        FROM public.warehouses
        WHERE id = NEW.warehouse_id;
      END IF;
      
      -- Try to get from store
      IF NEW.branch IS NULL AND NEW.store_id IS NOT NULL THEN
        SELECT branch INTO NEW.branch
        FROM public.stores
        WHERE id = NEW.store_id;
      END IF;
      
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
    
    -- Normalize branch to code
    NEW.branch := CASE
      WHEN NEW.branch ILIKE '%สอยดาว%' OR NEW.branch = 'SD' THEN 'SD'
      WHEN NEW.branch ILIKE '%สำนักงาน%' OR NEW.branch = 'HQ' OR NEW.branch IS NULL THEN 'HQ'
      ELSE 'HQ'
    END;
    
    branch_code := NEW.branch;
    current_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
    order_prefix := branch_code || '-ORD-' || current_year_month || '-';
    
    -- สร้าง lock key
    branch_hash := CASE 
      WHEN branch_code = 'HQ' THEN 72
      WHEN branch_code = 'SD' THEN 83
      ELSE 0
    END;
    
    lock_key := (branch_hash * 1000000 + CAST(current_year_month AS INTEGER))::BIGINT;
    
    -- Advisory lock
    PERFORM pg_advisory_xact_lock(lock_key);
    
    -- หา max number ด้วย logic ที่ง่ายกว่า
    -- 1. หา orders ที่มี prefix เดียวกัน
    -- 2. แยกเอาตัวเลข 4 หลักสุดท้าย
    -- 3. หา max แล้ว +1
    
    WITH numbered_orders AS (
      SELECT 
        order_number,
        CASE 
          WHEN order_number ~ ('^' || branch_code || '-ORD-' || current_year_month || '-[0-9]{4}$')
          THEN CAST(RIGHT(order_number, 4) AS INTEGER)
          ELSE 0
        END as seq_number
      FROM public.orders
      WHERE branch = branch_code
        AND order_number LIKE (order_prefix || '%')
        AND order_number IS NOT NULL
    )
    SELECT COALESCE(MAX(seq_number), 0)
    INTO max_number
    FROM numbered_orders;
    
    -- สร้าง order_number ใหม่
    -- ตรวจสอบว่า max_number ไม่เป็น negative หรือมากเกินไป
    IF max_number < 0 OR max_number > 9998 THEN
      max_number := 0;
    END IF;
    
    NEW.order_number := order_prefix || LPAD((max_number + 1)::TEXT, 4, '0');
    
    -- Log สำหรับ debug (optional - แสดงใน PostgreSQL logs)
    RAISE NOTICE 'Generated order_number: % (max was: %)', NEW.order_number, max_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Recreate trigger
-- ========================================

DROP TRIGGER IF EXISTS trigger_generate_order_number_on_trip_assignment ON public.orders;

CREATE TRIGGER trigger_generate_order_number_on_trip_assignment
  BEFORE INSERT OR UPDATE OF delivery_trip_id ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL AND NEW.delivery_trip_id IS NOT NULL)
  EXECUTE FUNCTION public.generate_order_number_on_trip_assignment();

-- ========================================
-- Debug: แสดง order numbers ที่ผิดปกติ
-- ========================================

-- หา orders ที่มี order_number = 0000
SELECT 
  id,
  order_number,
  branch,
  created_at
FROM public.orders
WHERE order_number LIKE '%-0000'
ORDER BY created_at DESC;

-- แสดง orders ทั้งหมดของ SD branch ในเดือนนี้
SELECT 
  order_number,
  branch,
  delivery_trip_id IS NOT NULL as has_trip,
  created_at,
  RIGHT(order_number, 4) as seq_num
FROM public.orders
WHERE branch = 'SD'
  AND order_number LIKE 'SD-ORD-2601-%'
ORDER BY created_at DESC
LIMIT 30;

-- ========================================
-- (Optional) แก้ไข order ที่เป็น 0000 ถ้ามี
-- ========================================

-- แสดงคำสั่งสำหรับแก้ไข (ไม่ได้รันอัตโนมัติ)
-- UPDATE orders SET order_number = 'SD-ORD-2601-0002' WHERE order_number = 'SD-ORD-2601-0000';
