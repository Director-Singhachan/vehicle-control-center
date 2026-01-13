-- ========================================
-- Fix Trip Number Generation Trigger
-- ========================================
-- This migration fixes the trip_number generation to use planned_date instead of NOW()
-- This ensures trip numbers are based on the trip's planned date, not creation date

-- Drop existing trigger first
DROP TRIGGER IF EXISTS trigger_generate_delivery_trip_number ON public.delivery_trips;

-- Recreate the function with the fix
CREATE OR REPLACE FUNCTION generate_delivery_trip_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  trip_year INTEGER;
  trip_month INTEGER;
  lock_key BIGINT;
BEGIN
  -- Extract year and month from planned_date (NOT NOW())
  trip_year := EXTRACT(YEAR FROM NEW.planned_date)::INTEGER;
  trip_month := EXTRACT(MONTH FROM NEW.planned_date)::INTEGER;
  
  -- Generate format: DT-YYMM-XXXX (e.g., DT-2601-0001)
  year_month_prefix := 'DT-' || 
    LPAD((trip_year % 100)::TEXT, 2, '0') || 
    LPAD(trip_month::TEXT, 2, '0') || 
    '-';
  
  -- Create a lock key based on year and month to prevent race conditions
  -- Using year*100 + month as lock key (e.g., 202601 for Jan 2026)
  lock_key := (trip_year * 100 + trip_month)::BIGINT;
  
  -- Acquire advisory lock (will be released at end of transaction)
  PERFORM pg_advisory_xact_lock(lock_key);
  
  -- Get last trip number for this year-month
  SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.delivery_trips
  WHERE trip_number LIKE year_month_prefix || '%'
    AND trip_number ~ (year_month_prefix || '[0-9]+$'); -- Ensure it matches the pattern
  
  -- Generate new number
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  NEW.trip_number := new_number;
  
  RAISE NOTICE 'Generated trip_number: % for planned_date: %', new_number, NEW.planned_date;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_generate_delivery_trip_number
  BEFORE INSERT ON public.delivery_trips
  FOR EACH ROW
  WHEN (NEW.trip_number IS NULL)
  EXECUTE FUNCTION generate_delivery_trip_number();

-- Verify the trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_generate_delivery_trip_number';

-- Test: Show recent trips and their trip_numbers
SELECT 
  id,
  trip_number,
  planned_date,
  status,
  created_at
FROM delivery_trips
ORDER BY created_at DESC
LIMIT 10;
