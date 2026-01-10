-- ========================================
-- Fix Missing trip_number for Existing Trips
-- แก้ไขทริปที่ไม่มี trip_number
-- ========================================
-- 
-- This script will:
-- 1. Find all delivery trips with NULL trip_number
-- 2. Generate trip_number for them based on created_at date
-- ========================================

-- Update trips with NULL trip_number
-- Generate trip_number based on created_at date
DO $$
DECLARE
  trip_record RECORD;
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  trip_year INTEGER;
  trip_month INTEGER;
  lock_key BIGINT;
BEGIN
  -- Loop through all trips without trip_number
  FOR trip_record IN 
    SELECT id, created_at 
    FROM public.delivery_trips 
    WHERE trip_number IS NULL
    ORDER BY created_at ASC
  LOOP
    -- Get year and month from created_at
    trip_year := EXTRACT(YEAR FROM trip_record.created_at)::INTEGER;
    trip_month := EXTRACT(MONTH FROM trip_record.created_at)::INTEGER;
    
    -- Generate format: DT-YYMM-XXXX (e.g., DT-2512-0001)
    year_month_prefix := 'DT-' || 
      LPAD((trip_year % 100)::TEXT, 2, '0') || 
      LPAD(trip_month::TEXT, 2, '0') || 
      '-';
    
    -- Create a lock key based on year and month
    lock_key := (trip_year * 100 + trip_month)::BIGINT;
    
    -- Acquire advisory lock
    PERFORM pg_advisory_xact_lock(lock_key);
    
    -- Get last trip number for this year-month
    SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
    INTO last_number
    FROM public.delivery_trips
    WHERE trip_number LIKE year_month_prefix || '%'
      AND trip_number ~ (year_month_prefix || '[0-9]+$');
    
    -- Generate new number
    new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
    
    -- Update the trip
    UPDATE public.delivery_trips
    SET trip_number = new_number
    WHERE id = trip_record.id;
    
    RAISE NOTICE 'Updated trip % with trip_number: %', trip_record.id, new_number;
  END LOOP;
END $$;

-- Verify the update
SELECT 
  COUNT(*) as total_trips,
  COUNT(trip_number) as trips_with_number,
  COUNT(*) - COUNT(trip_number) as trips_without_number
FROM public.delivery_trips;

-- Show sample of updated trips
SELECT 
  id,
  trip_number,
  status,
  planned_date,
  created_at
FROM public.delivery_trips
ORDER BY created_at DESC
LIMIT 10;
