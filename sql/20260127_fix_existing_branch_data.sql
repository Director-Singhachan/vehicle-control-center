-- Fix existing branch values and trip numbers
-- Date: 2026-01-27
-- Purpose: Normalize branch values and update trip numbers to new format

-- 1. Normalize branch values in all tables
-- Convert Thai branch names to codes

-- Profiles
UPDATE public.profiles
SET branch = CASE
  WHEN branch ILIKE '%สอยดาว%' OR branch = 'SD' THEN 'SD'
  WHEN branch ILIKE '%สำนักงานใหญ่%' OR branch = 'HQ' OR branch IS NULL THEN 'HQ'
  ELSE 'HQ'
END;

-- Vehicles  
UPDATE public.vehicles
SET branch = CASE
  WHEN branch ILIKE '%สอยดาว%' OR branch = 'SD' THEN 'SD'
  WHEN branch ILIKE '%สำนักงานใหญ่%' OR branch = 'HQ' OR branch IS NULL THEN 'HQ'
  ELSE 'HQ'
END;

-- Stores
UPDATE public.stores
SET branch = CASE
  WHEN branch ILIKE '%สอยดาว%' OR branch = 'SD' THEN 'SD'
  WHEN branch ILIKE '%สำนักงานใหญ่%' OR branch = 'HQ' OR branch IS NULL THEN 'HQ'
  ELSE 'HQ'
END
WHERE branch IS NOT NULL;

-- Delivery Trips
UPDATE public.delivery_trips
SET branch = CASE
  WHEN branch ILIKE '%สอยดาว%' OR branch = 'SD' THEN 'SD'
  WHEN branch ILIKE '%สำนักงานใหญ่%' OR branch = 'HQ' OR branch IS NULL THEN 'HQ'
  ELSE 'HQ'
END
WHERE branch IS NOT NULL;

-- Orders
UPDATE public.orders
SET branch = CASE
  WHEN branch ILIKE '%สอยดาว%' OR branch = 'SD' THEN 'SD'
  WHEN branch ILIKE '%สำนักงานใหญ่%' OR branch = 'HQ' OR branch IS NULL THEN 'HQ'
  ELSE 'HQ'
END
WHERE branch IS NOT NULL;

-- 2. Fix trip numbers that don't match the new format
-- Convert "สาขาสอยดาว-YYMM-XXXX" to "SD-YYMM-XXXX"
-- Convert "สำนักงานใหญ่-YYMM-XXXX" to "HQ-YYMM-XXXX"
UPDATE public.delivery_trips
SET trip_number = 'SD-' || SUBSTRING(trip_number FROM '([0-9]{4}-[0-9]{4})$')
WHERE trip_number LIKE 'สาขาสอยดาว-%'
  OR trip_number LIKE '%สอยดาว-%';

UPDATE public.delivery_trips
SET trip_number = 'HQ-' || SUBSTRING(trip_number FROM '([0-9]{4}-[0-9]{4})$')
WHERE trip_number LIKE 'สำนักงานใหญ่-%'
  OR trip_number LIKE '%สำนักงาน%-%';

-- 3. Fix order numbers similarly
UPDATE public.orders
SET order_number = 'SD-ORD-' || SUBSTRING(order_number FROM '([0-9]{4}-[0-9]{4})$')
WHERE order_number LIKE '%สอยดาว%'
  OR order_number LIKE 'สาขาสอยดาว-%';

UPDATE public.orders
SET order_number = 'HQ-ORD-' || SUBSTRING(order_number FROM '([0-9]{4}-[0-9]{4})$')
WHERE order_number LIKE '%สำนักงาน%'
  OR order_number LIKE 'สำนักงานใหญ่-%';

-- 4. Verify the changes
SELECT 
  'Profiles' as table_name,
  branch,
  COUNT(*) as count
FROM public.profiles
GROUP BY branch

UNION ALL

SELECT 
  'Vehicles' as table_name,
  branch,
  COUNT(*) as count
FROM public.vehicles
GROUP BY branch

UNION ALL

SELECT 
  'Stores' as table_name,
  branch,
  COUNT(*) as count
FROM public.stores
GROUP BY branch

UNION ALL

SELECT 
  'Delivery Trips' as table_name,
  branch,
  COUNT(*) as count
FROM public.delivery_trips
GROUP BY branch

UNION ALL

SELECT 
  'Orders' as table_name,
  branch,
  COUNT(*) as count
FROM public.orders
GROUP BY branch

ORDER BY table_name, branch;

-- Show sample trip numbers
SELECT 
  trip_number,
  branch,
  planned_date,
  status
FROM public.delivery_trips
ORDER BY created_at DESC
LIMIT 10;

-- Show sample order numbers
SELECT 
  order_number,
  branch,
  order_date,
  status
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;
