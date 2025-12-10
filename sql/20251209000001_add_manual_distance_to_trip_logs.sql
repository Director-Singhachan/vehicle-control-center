-- Add manual distance support for vehicles with broken odometers
-- Migration: 20251209000001_add_manual_distance_to_trip_logs.sql

-- Add manual_distance_km column to trip_logs
ALTER TABLE trip_logs 
ADD COLUMN IF NOT EXISTS manual_distance_km integer;

-- Make odometer_start nullable (for manual distance mode)
ALTER TABLE trip_logs 
ALTER COLUMN odometer_start DROP NOT NULL;

-- Drop existing distance_km generated column if it exists
ALTER TABLE trip_logs 
DROP COLUMN IF EXISTS distance_km CASCADE;

-- Add new distance_km column that uses manual distance when available
-- Priority: manual_distance_km > calculated from odometer
ALTER TABLE trip_logs
ADD COLUMN distance_km integer GENERATED ALWAYS AS (
  COALESCE(manual_distance_km, odometer_end - odometer_start)
) STORED;

-- Add check constraint to ensure either odometer or manual distance is provided
-- For checkout: must have odometer_start OR manual_distance_km
-- For checkin: if started with odometer, must end with odometer
ALTER TABLE trip_logs
DROP CONSTRAINT IF EXISTS check_distance_method;

ALTER TABLE trip_logs
ADD CONSTRAINT check_distance_method 
CHECK (
  -- Normal mode: Both odometers present, Manual is NULL
  (odometer_start IS NOT NULL AND odometer_end IS NOT NULL AND manual_distance_km IS NULL) OR
  
  -- Manual mode: Manual is present, Odometer End is NULL (Odometer Start can be anything)
  (manual_distance_km IS NOT NULL AND odometer_end IS NULL) OR
  
  -- Checkout mode (Normal): Start present, End NULL, Manual NULL
  (odometer_start IS NOT NULL AND odometer_end IS NULL AND manual_distance_km IS NULL) OR
  
  -- Checkout mode (Manual/Pending): Start NULL, End NULL, Manual NULL (waiting for input)
  (odometer_start IS NULL AND odometer_end IS NULL AND manual_distance_km IS NULL AND status = 'checked_out')
);

-- Add comment to explain the new column
COMMENT ON COLUMN trip_logs.manual_distance_km IS 'Manual distance entry for vehicles with broken odometers. When set, odometer readings are not required.';

-- Create index for manual distance queries
CREATE INDEX IF NOT EXISTS idx_trip_logs_manual_distance 
ON trip_logs(manual_distance_km) 
WHERE manual_distance_km IS NOT NULL;
