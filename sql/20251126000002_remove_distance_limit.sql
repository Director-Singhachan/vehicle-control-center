-- ========================================
-- Remove 500km Distance Limit from Trip Logs
-- ลบข้อจำกัดระยะทาง 500 กม. ออกจากระบบ
-- ========================================

-- 1. Drop the check constraint
ALTER TABLE public.trip_logs 
DROP CONSTRAINT IF EXISTS trip_logs_max_distance;

-- 2. Replace the validation trigger function to remove distance check
CREATE OR REPLACE FUNCTION public.validate_trip_odometer()
RETURNS TRIGGER AS $$
DECLARE
  last_odometer INTEGER;
BEGIN
  -- When checking in, validate odometer_end
  IF new.status = 'checked_in' AND new.odometer_end IS NOT NULL THEN
    -- Get the last odometer reading (from fuel_records or previous trip)
    SELECT COALESCE(
      (SELECT odometer FROM public.fuel_records 
       WHERE vehicle_id = new.vehicle_id 
       ORDER BY filled_at DESC LIMIT 1),
      (SELECT odometer_end FROM public.trip_logs 
       WHERE vehicle_id = new.vehicle_id 
       AND odometer_end IS NOT NULL
       ORDER BY checkin_time DESC LIMIT 1),
      0
    ) INTO last_odometer;
    
    -- Check if odometer_end is reasonable (not less than last known reading)
    IF new.odometer_end < last_odometer THEN
      RAISE EXCEPTION 'Odometer reading (%) is less than last known reading (%). Please verify.', 
        new.odometer_end, last_odometer;
    END IF;
    
    -- NOTE: Distance validation (> 500 km) is now handled at UI level with user confirmation
    -- We don't block saving here to allow legitimate long-distance trips
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON FUNCTION public.validate_trip_odometer() IS 
  'Validates trip odometer readings. Distance > 500km is now handled at UI level with confirmation dialog.';
