-- ========================================
-- Fix Missing Trip Numbers
-- ========================================
-- This script populates trip_number for trips that are missing it

-- Step 1: Check current state (how many trips are missing trip_number)
SELECT 
  COUNT(*) as total_trips_without_number,
  COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
FROM delivery_trips
WHERE trip_number IS NULL;

-- Step 2: Preview trips that will be fixed
SELECT 
  dt.id,
  dt.sequence_order,
  dt.planned_date,
  dt.status,
  dt.created_at,
  v.plate as vehicle_plate,
  p.full_name as driver_name
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
LEFT JOIN profiles p ON dt.driver_id = p.id
WHERE dt.trip_number IS NULL
ORDER BY dt.planned_date DESC, dt.created_at DESC
LIMIT 20;

-- Step 3: Fix missing trip_numbers
-- This will generate trip_number based on planned_date for each trip
DO $$
DECLARE
  trip_record RECORD;
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  trip_year INTEGER;
  trip_month INTEGER;
BEGIN
  -- Loop through each trip without trip_number
  FOR trip_record IN 
    SELECT id, planned_date
    FROM delivery_trips
    WHERE trip_number IS NULL
    ORDER BY planned_date ASC, created_at ASC
  LOOP
    -- Extract year and month from planned_date
    trip_year := EXTRACT(YEAR FROM trip_record.planned_date)::INTEGER;
    trip_month := EXTRACT(MONTH FROM trip_record.planned_date)::INTEGER;
    
    -- Generate format: DT-YYMM-XXXX (e.g., DT-2601-0001)
    year_month_prefix := 'DT-' || 
      LPAD((trip_year % 100)::TEXT, 2, '0') || 
      LPAD(trip_month::TEXT, 2, '0') || 
      '-';
    
    -- Get last trip number for this year-month
    SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
    INTO last_number
    FROM delivery_trips
    WHERE trip_number LIKE year_month_prefix || '%'
      AND trip_number ~ (year_month_prefix || '[0-9]+$');
    
    -- Generate new number
    new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
    
    -- Update the trip
    UPDATE delivery_trips
    SET trip_number = new_number,
        updated_at = NOW()
    WHERE id = trip_record.id;
    
    RAISE NOTICE 'Updated trip % with trip_number: %', trip_record.id, new_number;
  END LOOP;
  
  RAISE NOTICE 'Completed updating trip numbers';
END $$;

-- Step 4: Verify the fix
SELECT 
  COUNT(*) as trips_without_number
FROM delivery_trips
WHERE trip_number IS NULL;

-- Should return 0 if all trips now have trip_number

-- Step 5: Show sample of updated trips
SELECT 
  dt.trip_number,
  dt.sequence_order,
  dt.planned_date,
  dt.status,
  v.plate as vehicle_plate
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
ORDER BY dt.created_at DESC
LIMIT 10;
