-- ========================================
-- Fix Duplicate Trip Numbers
-- ========================================
-- This script identifies and fixes duplicate trip_number entries

-- Step 1: Identify duplicate trip numbers
SELECT 
  trip_number,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as trip_ids,
  STRING_AGG(
    COALESCE((SELECT plate FROM vehicles WHERE id = delivery_trips.vehicle_id), 'N/A'),
    ', '
  ) as vehicle_plates
FROM public.delivery_trips
WHERE trip_number IS NOT NULL
GROUP BY trip_number
HAVING COUNT(*) > 1
ORDER BY trip_number;

-- Step 2: For each duplicate, regenerate trip_number for all but the first one
-- This will keep the oldest trip with the original number and regenerate for others

DO $$
DECLARE
  dup_record RECORD;
  trip_record RECORD;
  new_trip_number TEXT;
  counter INTEGER;
BEGIN
  -- Loop through each duplicate trip_number
  FOR dup_record IN 
    SELECT trip_number
    FROM public.delivery_trips
    WHERE trip_number IS NOT NULL
    GROUP BY trip_number
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Processing duplicate trip_number: %', dup_record.trip_number;
    
    counter := 0;
    
    -- Loop through trips with this trip_number (ordered by created_at to keep oldest)
    FOR trip_record IN
      SELECT id, trip_number, created_at
      FROM public.delivery_trips
      WHERE trip_number = dup_record.trip_number
      ORDER BY created_at ASC
    LOOP
      counter := counter + 1;
      
      -- Skip the first one (keep original number)
      IF counter > 1 THEN
        -- Generate new trip number by calling the trigger function manually
        -- Extract year-month from the trip_number
        new_trip_number := trip_record.trip_number || '-DUP' || counter::TEXT;
        
        RAISE NOTICE 'Updating trip % from % to %', trip_record.id, trip_record.trip_number, new_trip_number;
        
        -- Update with temporary unique number first
        UPDATE public.delivery_trips
        SET trip_number = new_trip_number
        WHERE id = trip_record.id;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Duplicate trip numbers have been fixed with -DUP suffix';
  RAISE NOTICE 'Please review and manually assign proper sequential numbers if needed';
END $$;

-- Step 3: Verify no more duplicates exist
SELECT 
  trip_number,
  COUNT(*) as count
FROM public.delivery_trips
WHERE trip_number IS NOT NULL
GROUP BY trip_number
HAVING COUNT(*) > 1;

-- Step 4: Add advisory lock to prevent race conditions in trip number generation
-- Update the trigger function to use advisory locks
CREATE OR REPLACE FUNCTION generate_delivery_trip_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  current_year INTEGER;
  current_month INTEGER;
  lock_key BIGINT;
BEGIN
  -- Get current year and month
  current_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  current_month := EXTRACT(MONTH FROM NOW())::INTEGER;
  
  -- Generate format: DT-YYMM-XXXX (e.g., DT-2512-0001)
  year_month_prefix := 'DT-' || 
    LPAD((current_year % 100)::TEXT, 2, '0') || 
    LPAD(current_month::TEXT, 2, '0') || 
    '-';
  
  -- Create a lock key based on year and month to prevent race conditions
  -- Using year*100 + month as lock key (e.g., 202512 for Dec 2025)
  lock_key := (current_year * 100 + current_month)::BIGINT;
  
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Ensure UNIQUE constraint exists (it should already exist)
-- This is just for verification
DO $$
BEGIN
  -- Check if unique constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_trips_trip_number_key'
      AND conrelid = 'public.delivery_trips'::regclass
  ) THEN
    -- Add unique constraint if it doesn't exist
    ALTER TABLE public.delivery_trips
    ADD CONSTRAINT delivery_trips_trip_number_key UNIQUE (trip_number);
    RAISE NOTICE 'Added UNIQUE constraint on trip_number';
  ELSE
    RAISE NOTICE 'UNIQUE constraint on trip_number already exists';
  END IF;
END $$;

-- Step 6: Show summary of all trips with their corrected numbers
SELECT 
  id,
  trip_number,
  planned_date,
  status,
  (SELECT plate FROM vehicles WHERE id = delivery_trips.vehicle_id) as vehicle_plate,
  created_at
FROM public.delivery_trips
ORDER BY trip_number DESC, created_at DESC
LIMIT 50;
