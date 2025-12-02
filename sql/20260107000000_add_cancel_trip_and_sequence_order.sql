-- ========================================
-- Add Cancel Trip Feature and Sequence Order for Delivery Trips
-- ========================================
-- 1. เพิ่ม 'cancelled' status ใน trip_logs
-- 2. เพิ่ม sequence_order ใน delivery_trips สำหรับเรียงลำดับทริปที่ใช้ทะเบียนเดียวกัน

-- ========================================
-- 1. Update trip_logs status to include 'cancelled'
-- ========================================

-- First, drop the existing check constraint (if it exists)
DO $$ 
BEGIN
  -- Check if constraint exists and drop it
  -- The constraint name might be different, so we'll try multiple names
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname LIKE '%trip_logs%status%' 
    AND conrelid = 'public.trip_logs'::regclass
  ) THEN
    -- Drop all constraints that match the pattern
    EXECUTE (
      SELECT 'ALTER TABLE public.trip_logs DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conname LIKE '%trip_logs%status%'
      AND conrelid = 'public.trip_logs'::regclass
      LIMIT 1
    );
  END IF;
END $$;

-- Add new constraint with 'cancelled' status
ALTER TABLE public.trip_logs 
  ADD CONSTRAINT trip_logs_status_check 
  CHECK (status IN ('checked_out', 'checked_in', 'cancelled'));

-- Update the trigger function to allow cancelling trips
-- (cancelled trips should not block new checkouts)
CREATE OR REPLACE FUNCTION public.check_vehicle_available()
RETURNS TRIGGER AS $$
DECLARE
  active_trip_count INTEGER;
BEGIN
  -- Check if vehicle already has an active trip (only for checked_out status)
  -- Cancelled trips should not block new checkouts
  IF NEW.status = 'checked_out' THEN
    SELECT COUNT(*) INTO active_trip_count
    FROM public.trip_logs
    WHERE vehicle_id = NEW.vehicle_id
      AND status = 'checked_out'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF active_trip_count > 0 THEN
      RAISE EXCEPTION 'Vehicle already has an active trip. Please check-in or cancel first.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. Add sequence_order to delivery_trips
-- ========================================

-- Add sequence_order column (default to 0, will be set when creating trips)
ALTER TABLE public.delivery_trips 
  ADD COLUMN IF NOT EXISTS sequence_order INTEGER NOT NULL DEFAULT 0;

-- Add comment
COMMENT ON COLUMN public.delivery_trips.sequence_order IS 
  'ลำดับการใช้งานทริปสำหรับรถคันเดียวกัน (1, 2, 3, ...) - ใช้สำหรับเรียงลำดับทริปที่ใช้ทะเบียนเดียวกัน';

-- Create index for better query performance when filtering by vehicle and sequence
CREATE INDEX IF NOT EXISTS idx_delivery_trips_vehicle_sequence 
  ON public.delivery_trips(vehicle_id, sequence_order);

-- ========================================
-- 3. Update existing delivery_trips to set sequence_order based on planned_date
-- ========================================

-- For existing trips, set sequence_order based on planned_date and created_at
-- This ensures existing trips have proper sequence ordering
DO $$
DECLARE
  vehicle_record RECORD;
  trip_record RECORD;
  seq_num INTEGER;
BEGIN
  -- Loop through each vehicle
  FOR vehicle_record IN 
    SELECT DISTINCT vehicle_id FROM public.delivery_trips
  LOOP
    seq_num := 1;
    -- Order by planned_date (ascending), then created_at (ascending)
    FOR trip_record IN
      SELECT id 
      FROM public.delivery_trips 
      WHERE vehicle_id = vehicle_record.vehicle_id
      ORDER BY planned_date ASC, created_at ASC
    LOOP
      UPDATE public.delivery_trips
      SET sequence_order = seq_num
      WHERE id = trip_record.id;
      seq_num := seq_num + 1;
    END LOOP;
  END LOOP;
END $$;

