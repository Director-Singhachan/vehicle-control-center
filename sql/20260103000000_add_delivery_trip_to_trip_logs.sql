-- ========================================
-- Add delivery_trip_id to trip_logs and update trip_number format
-- ========================================

-- 1. Add delivery_trip_id column to trip_logs
ALTER TABLE public.trip_logs
ADD COLUMN IF NOT EXISTS delivery_trip_id UUID REFERENCES public.delivery_trips(id) ON DELETE SET NULL;

-- 2. Create index for delivery_trip_id
CREATE INDEX IF NOT EXISTS idx_trip_logs_delivery_trip_id ON public.trip_logs(delivery_trip_id);

-- 3. Update trip_number generation function to new format: DT-YYMM-XXXX
-- Format: DT-2511-0001 (Year 25, Month 11, Trip 0001)
CREATE OR REPLACE FUNCTION generate_delivery_trip_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  current_year INTEGER;
  current_month INTEGER;
BEGIN
  -- Get current year and month
  current_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  current_month := EXTRACT(MONTH FROM NOW())::INTEGER;
  
  -- Generate format: DT-YYMM-XXXX (e.g., DT-2511-0001)
  -- YY = last 2 digits of year (25 for 2025)
  -- MM = month (11 for November)
  -- XXXX = trip number (0001, 0002, etc.)
  year_month_prefix := 'DT-' || 
    LPAD((current_year % 100)::TEXT, 2, '0') || 
    LPAD(current_month::TEXT, 2, '0') || 
    '-';
  
  -- Get last trip number for this year-month
  SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.delivery_trips
  WHERE trip_number LIKE year_month_prefix || '%';
  
  -- Generate new number
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  NEW.trip_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Add comment to explain the format
COMMENT ON COLUMN public.delivery_trips.trip_number IS 'Format: DT-YYMM-XXXX (e.g., DT-2511-0001 = Year 2025, Month 11, Trip 0001)';
COMMENT ON COLUMN public.trip_logs.delivery_trip_id IS 'Reference to delivery_trips table to link trip log with delivery trip';

