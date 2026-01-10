-- ========================================
-- Debug: Check trip_number values
-- ตรวจสอบค่า trip_number ในฐานข้อมูล
-- ========================================

-- 1. Check if trip_number exists and has values
SELECT 
  id,
  trip_number,
  status,
  planned_date,
  created_at
FROM public.delivery_trips
ORDER BY created_at DESC
LIMIT 10;

-- 2. Count trips with NULL trip_number
SELECT 
  COUNT(*) as total_trips,
  COUNT(trip_number) as trips_with_number,
  COUNT(*) - COUNT(trip_number) as trips_without_number
FROM public.delivery_trips;

-- 3. Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'delivery_trips'
  AND trigger_name = 'trigger_generate_delivery_trip_number';

-- 4. Check current RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'delivery_trips'
ORDER BY policyname;
