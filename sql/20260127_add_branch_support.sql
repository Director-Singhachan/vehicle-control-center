-- Migration: Add branch support to profiles and delivery_trips
-- Date: 2026-01-27
-- Purpose: เพิ่มการแยกสาขาให้กับระบบ (HQ และ SD) เพื่อให้แต่ละสาขาเห็นเฉพาะข้อมูลของสาขาตนเอง

-- 1. Add branch column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS branch TEXT;

-- Set default branch based on user's role or existing data
-- HQ = สำนักงานใหญ่, SD = สาขาสอยดาว
UPDATE public.profiles
SET branch = 'HQ'
WHERE branch IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_branch
  ON public.profiles(branch);

COMMENT ON COLUMN public.profiles.branch IS 'สาขาของผู้ใช้ (HQ = สำนักงานใหญ่, SD = สาขาสอยดาว)';

-- 2. Add branch column to delivery_trips table
ALTER TABLE public.delivery_trips
ADD COLUMN IF NOT EXISTS branch TEXT;

-- Set branch based on vehicle's branch (if vehicle has branch info)
UPDATE public.delivery_trips dt
SET branch = v.branch
FROM public.vehicles v
WHERE dt.vehicle_id = v.id
  AND dt.branch IS NULL
  AND v.branch IS NOT NULL;

-- For trips without vehicle branch, default to HQ
UPDATE public.delivery_trips
SET branch = 'HQ'
WHERE branch IS NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_trips_branch
  ON public.delivery_trips(branch);

COMMENT ON COLUMN public.delivery_trips.branch IS 'สาขาของทริปส่งสินค้า (HQ = สำนักงานใหญ่, SD = สาขาสอยดาว)';

-- 3. Add branch column to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS branch TEXT;

-- Set default branch for stores
UPDATE public.stores
SET branch = 'HQ'
WHERE branch IS NULL;

CREATE INDEX IF NOT EXISTS idx_stores_branch
  ON public.stores(branch);

COMMENT ON COLUMN public.stores.branch IS 'สาขาของร้านค้า (HQ = สำนักงานใหญ่, SD = สาขาสอยดาว)';

-- 4. Add branch column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS branch TEXT;

-- Set branch based on store's branch (assuming stores have branch info)
-- If stores don't have branch, we'll use the created_by user's branch
UPDATE public.orders o
SET branch = COALESCE(
  (SELECT s.branch FROM public.stores s WHERE s.id = o.store_id),
  (SELECT p.branch FROM public.profiles p WHERE p.id = o.created_by),
  'HQ'
)
WHERE o.branch IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_branch
  ON public.orders(branch);

COMMENT ON COLUMN public.orders.branch IS 'สาขาของออเดอร์ (HQ = สำนักงานใหญ่, SD = สาขาสอยดาว)';

-- 4. Create function to auto-set branch on new delivery trips (based on vehicle)
CREATE OR REPLACE FUNCTION public.set_delivery_trip_branch()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้ายังไม่มี branch ให้ดึงจาก vehicle
  IF NEW.branch IS NULL THEN
    SELECT branch INTO NEW.branch
    FROM public.vehicles
    WHERE id = NEW.vehicle_id;
    
    -- ถ้า vehicle ไม่มี branch ให้ default เป็น HQ
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

-- 5. Create function to auto-set branch on new orders (based on store or user)
CREATE OR REPLACE FUNCTION public.set_order_branch()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้ายังไม่มี branch ให้ดึงจาก store หรือ user ที่สร้าง
  IF NEW.branch IS NULL THEN
    -- Try to get from store first
    SELECT branch INTO NEW.branch
    FROM public.stores
    WHERE id = NEW.store_id;
   
    -- If store doesn't have branch, try from created_by user
    IF NEW.branch IS NULL THEN
      SELECT branch INTO NEW.branch
      FROM public.profiles
      WHERE id = NEW.created_by;
    END IF;
    
    -- If still null, default to HQ
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

-- 6. Create triggers
DROP TRIGGER IF EXISTS trigger_set_delivery_trip_branch ON public.delivery_trips;
CREATE TRIGGER trigger_set_delivery_trip_branch
  BEFORE INSERT ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivery_trip_branch();

DROP TRIGGER IF EXISTS trigger_set_order_branch ON public.orders;
CREATE TRIGGER trigger_set_order_branch
  BEFORE INSERT ON public.orders  
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_branch();

-- 7. Update trip number generation to include branch prefix
-- Format: HQ-YYMM-XXXX or SD-YYMM-XXXX
CREATE OR REPLACE FUNCTION public.generate_delivery_trip_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month TEXT;
  next_sequence INT;
  branch_prefix TEXT;
BEGIN
  -- Only generate if trip_number is NULL
  IF NEW.trip_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure branch is set
  IF NEW.branch IS NULL THEN
    SELECT branch INTO NEW.branch
    FROM public.vehicles
    WHERE id = NEW.vehicle_id;
    
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

  -- Set branch prefix from normalized branch
  branch_prefix := NEW.branch;

  -- Get year-month from planned_date (format: YYMM)
  year_month := TO_CHAR(NEW.planned_date, 'YYMM');

  -- Get next sequence number for this branch and year-month
  SELECT COALESCE(MAX(
    CASE 
      WHEN trip_number ~ ('^' || branch_prefix || '-' || year_month || '-[0-9]{4}$')
      THEN CAST(SUBSTRING(trip_number FROM LENGTH(branch_prefix) + LENGTH(year_month) + 3) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM public.delivery_trips
  WHERE branch = NEW.branch
    AND trip_number LIKE (branch_prefix || '-' || year_month || '-%');

  -- Generate trip_number: BRANCH-YYMM-XXXX (e.g., HQ-2601-0001, SD-2601-0002)
  NEW.trip_number := branch_prefix || '-' || year_month || '-' || LPAD(next_sequence::TEXT, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Update order number generation to include branch prefix
-- Format: HQ-ORD-YYMM-XXXX or SD-ORD-YYMM-XXXX
CREATE OR REPLACE FUNCTION public.generate_order_number_with_branch()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  max_number INT;
  current_year_month TEXT;
  branch_code TEXT;
  order_branch TEXT;
BEGIN
  -- Get branch from the current insert/update context
  -- This will be set by the trigger before this function runs
  SELECT branch INTO order_branch FROM public.orders WHERE id = NEW.id;
  
  -- Default to HQ if branch is not set
  branch_code := COALESCE(order_branch, 'HQ');
  
  -- Format: YYMM (e.g., 2601 for January 2026)
  current_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  
  -- Find the latest number for this branch and month
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
  
  -- Generate new number: BRANCH-ORD-YYMM-XXXX
  new_number := branch_code || '-ORD-' || current_year_month || '-' || LPAD((max_number + 1)::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 9. Update set_order_number function to use branch-aware generation
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
DECLARE
  branch_code TEXT;
  current_year_month TEXT;
  max_number INT;
BEGIN
  IF NEW.order_number IS NULL THEN
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

-- Drop and recreate triggers
DROP TRIGGER IF EXISTS trigger_generate_delivery_trip_number ON public.delivery_trips;
CREATE TRIGGER trigger_generate_delivery_trip_number
  BEFORE INSERT ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_delivery_trip_number();

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_number();

-- 10. Note: Views for all branches are NOT created for security reasons
-- Users will query delivery_trips and orders tables directly with branch filters
-- Admin users can see all branches by using branch='ALL' filter in the application
-- This approach is more secure and respects Row Level Security (RLS) policies
