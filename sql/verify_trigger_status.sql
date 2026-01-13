-- ========================================
-- Verify Trigger Status and Function
-- ========================================

-- 1. Check if trigger exists and is enabled
SELECT 
  '=== TRIGGER STATUS ===' as info;

SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ ENABLED (Origin)'
    WHEN tgenabled = 'D' THEN '❌ DISABLED'
    WHEN tgenabled = 'R' THEN '✅ ENABLED (Replica)'
    WHEN tgenabled = 'A' THEN '✅ ENABLED (Always)'
    ELSE '⚠️ UNKNOWN: ' || tgenabled
  END as status,
  tgenabled as raw_status
FROM pg_trigger
WHERE tgname = 'trigger_generate_delivery_trip_number';

-- 2. Check function source code
SELECT 
  '=== FUNCTION SOURCE CODE ===' as info;

SELECT 
  proname as function_name,
  prosrc as source_code
FROM pg_proc
WHERE proname = 'generate_delivery_trip_number';

-- 3. Check if function uses planned_date or NOW()
SELECT 
  '=== CHECKING IF FUNCTION USES planned_date ===' as info;

SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%NEW.planned_date%' THEN '✅ Uses NEW.planned_date (CORRECT)'
    WHEN prosrc LIKE '%NOW()%' THEN '❌ Uses NOW() (INCORRECT - needs fix)'
    ELSE '⚠️ Cannot determine'
  END as uses_planned_date,
  CASE 
    WHEN prosrc LIKE '%NOW()%' THEN '❌ Found NOW() in function'
    ELSE '✅ No NOW() found'
  END as uses_now
FROM pg_proc
WHERE proname = 'generate_delivery_trip_number';

-- 4. Show current trips with NULL trip_number
SELECT 
  '=== TRIPS WITH NULL TRIP_NUMBER ===' as info;

SELECT 
  COUNT(*) as total_null_trips,
  MIN(planned_date) as earliest_date,
  MAX(planned_date) as latest_date
FROM delivery_trips
WHERE trip_number IS NULL;

-- 5. Show detailed trips with NULL
SELECT 
  id,
  planned_date,
  status,
  created_at,
  '❌ NULL' as trip_number_status
FROM delivery_trips
WHERE trip_number IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- 6. Show next expected trip number for January 2026
SELECT 
  '=== NEXT TRIP NUMBER FOR JANUARY 2026 ===' as info;

SELECT 
  'DT-2601' as prefix,
  COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0) as current_max,
  'DT-2601-' || LPAD((COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0) + 1)::TEXT, 4, '0') as next_expected_number
FROM delivery_trips
WHERE trip_number LIKE 'DT-2601-%'
  AND trip_number ~ 'DT-2601-[0-9]+$';

-- 7. Recommendation
SELECT 
  '=== RECOMMENDATION ===' as info;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'generate_delivery_trip_number' 
        AND prosrc LIKE '%NEW.planned_date%'
    ) THEN '✅ Function is correct - uses planned_date'
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'generate_delivery_trip_number' 
        AND prosrc LIKE '%NOW()%'
    ) THEN '❌ Function needs fix - uses NOW() instead of planned_date. Run: sql/20260113000000_fix_trip_number_generation.sql'
    ELSE '⚠️ Cannot determine - please check function manually'
  END as recommendation;
