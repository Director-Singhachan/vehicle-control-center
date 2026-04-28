-- Add service_type to delivery trips for commission rate selection
-- carry_in = ลงมือ, lift_off = ตักลง, standard = default/backward compatibility

ALTER TABLE public.delivery_trips
ADD COLUMN IF NOT EXISTS service_type TEXT;

UPDATE public.delivery_trips
SET service_type = 'standard'
WHERE service_type IS NULL;

ALTER TABLE public.delivery_trips
ALTER COLUMN service_type SET DEFAULT 'standard';

ALTER TABLE public.delivery_trips
ALTER COLUMN service_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_trips_service_type_check'
  ) THEN
    ALTER TABLE public.delivery_trips
    ADD CONSTRAINT delivery_trips_service_type_check
    CHECK (service_type IN ('standard', 'carry_in', 'lift_off'));
  END IF;
END $$;

COMMENT ON COLUMN public.delivery_trips.service_type IS
'ประเภทบริการสำหรับคอมมิชชั่น: standard(default), carry_in(ลงมือ), lift_off(ตักลง)';
