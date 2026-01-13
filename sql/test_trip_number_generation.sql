-- ========================================
-- Test Trip Number Generation
-- ========================================
-- This script tests the trip_number generation to ensure it works correctly

-- Step 1: Check if trigger exists and is enabled
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ Enabled'
    WHEN tgenabled = 'D' THEN '❌ Disabled'
    ELSE '⚠️ Unknown'
  END as status
FROM pg_trigger
WHERE tgname = 'trigger_generate_delivery_trip_number';

-- Step 2: Check current max trip_number for January 2026
SELECT 
  'DT-2601' as prefix,
  COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0) as last_number,
  'DT-2601-' || LPAD((COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0) + 1)::TEXT, 4, '0') as next_trip_number
FROM delivery_trips
WHERE trip_number LIKE 'DT-2601-%'
  AND trip_number ~ 'DT-2601-[0-9]+$';

-- Step 3: Show all trips for January 2026
SELECT 
  trip_number,
  planned_date,
  status,
  created_at,
  CASE 
    WHEN trip_number IS NULL THEN '❌ NULL (needs fix)'
    ELSE '✅ OK'
  END as trip_number_status
FROM delivery_trips
WHERE planned_date >= '2026-01-01' 
  AND planned_date < '2026-02-01'
ORDER BY 
  CASE WHEN trip_number IS NULL THEN 1 ELSE 0 END,
  trip_number DESC;

-- Step 4: Count trips by status
SELECT 
  COUNT(*) as total_trips,
  COUNT(CASE WHEN trip_number IS NULL THEN 1 END) as trips_without_number,
  COUNT(CASE WHEN trip_number IS NOT NULL THEN 1 END) as trips_with_number,
  ROUND(COUNT(CASE WHEN trip_number IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 2) as percentage_complete
FROM delivery_trips
WHERE planned_date >= '2026-01-01' 
  AND planned_date < '2026-02-01';

-- Step 5: Test the function directly (simulation)
-- This shows what the next trip_number would be
DO $$
DECLARE
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  trip_year INTEGER := 2026;
  trip_month INTEGER := 1;
BEGIN
  -- Generate format: DT-YYMM-XXXX
  year_month_prefix := 'DT-' || 
    LPAD((trip_year % 100)::TEXT, 2, '0') || 
    LPAD(trip_month::TEXT, 2, '0') || 
    '-';
  
  -- Get last trip number
  SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM delivery_trips
  WHERE trip_number LIKE year_month_prefix || '%'
    AND trip_number ~ (year_month_prefix || '[0-9]+$');
  
  -- Generate new number
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Trip Number Generation Test';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Prefix: %', year_month_prefix;
  RAISE NOTICE 'Last number: %', last_number;
  RAISE NOTICE 'Next trip_number: %', new_number;
  RAISE NOTICE '========================================';
END $$;

-- Step 6: Show function definition
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'generate_delivery_trip_number';
