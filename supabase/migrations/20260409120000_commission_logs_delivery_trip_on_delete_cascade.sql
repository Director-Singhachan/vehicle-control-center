-- commission_logs.delivery_trip_id was ON DELETE RESTRICT, which blocks
-- deleting delivery_trips while commission_logs still reference the trip.
-- CASCADE matches app behavior (auto-commission worker replaces logs per trip)
-- and allows intentional trip deletion without manual commission_logs cleanup.

ALTER TABLE public.commission_logs
  DROP CONSTRAINT IF EXISTS commission_logs_delivery_trip_id_fkey;

ALTER TABLE public.commission_logs
  ADD CONSTRAINT commission_logs_delivery_trip_id_fkey
  FOREIGN KEY (delivery_trip_id)
  REFERENCES public.delivery_trips(id)
  ON DELETE CASCADE;
