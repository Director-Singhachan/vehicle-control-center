-- ========================================
-- Allow Admin to Edit Historical Odometer Readings
-- แก้ไข validate_trip_odometer function ให้ยกเว้นการตรวจสอบเมื่อ UPDATE
-- ========================================

-- Modify validate_trip_odometer to skip validation on UPDATE operations
-- This allows admins to edit historical trip logs without odometer validation errors
CREATE OR REPLACE FUNCTION public.validate_trip_odometer()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  last_odometer INTEGER;
BEGIN
  -- Skip validation for UPDATE operations (allow editing historical records)
  -- Only validate on INSERT (new records)
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- When checking in, validate odometer_end
  IF NEW.status = 'checked_in' AND NEW.odometer_end IS NOT NULL THEN
    -- Get the last odometer reading (from fuel_records or previous trip)
    SELECT COALESCE(
      (SELECT odometer FROM public.fuel_records 
       WHERE vehicle_id = NEW.vehicle_id 
       ORDER BY filled_at DESC LIMIT 1),
      (SELECT odometer_end FROM public.trip_logs 
       WHERE vehicle_id = NEW.vehicle_id 
       AND odometer_end IS NOT NULL
       ORDER BY checkin_time DESC LIMIT 1),
      0
    ) INTO last_odometer;
    
    -- Check if odometer_end is reasonable (not less than last known reading)
    IF NEW.odometer_end < last_odometer THEN
      RAISE EXCEPTION 'Odometer reading (%) is less than last known reading (%). Please verify.', 
        NEW.odometer_end, last_odometer;
    END IF;
    
    -- NOTE: Distance validation (> 500 km) is now handled at UI level with user confirmation
    -- We don't block saving here to allow legitimate long-distance trips
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_trip_odometer() IS 
  'Validate odometer readings on INSERT only, allow UPDATE for historical edits';
