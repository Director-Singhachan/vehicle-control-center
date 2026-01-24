-- ========================================
-- Fix trip_logs UPDATE policy for staff
-- ========================================
-- Problem: RLS update policy only allows driver_id = auth.uid()
--          which blocks admin/manager/inspector from cancelling trips.
-- Fix: Allow staff roles to update any trip_logs row.

DO $$
BEGIN
  -- Recreate update policy with staff allowance
  DROP POLICY IF EXISTS "Drivers can update own trips" ON public.trip_logs;

  CREATE POLICY "Drivers can update own trips"
  ON public.trip_logs
  FOR UPDATE
  TO authenticated
  USING (
    driver_id = (select auth.uid())
    OR public.has_role((select auth.uid()), ARRAY['manager', 'executive', 'admin', 'inspector'])
  )
  WITH CHECK (
    driver_id = (select auth.uid())
    OR public.has_role((select auth.uid()), ARRAY['manager', 'executive', 'admin', 'inspector'])
  );

  RAISE NOTICE '✅ Fixed: trip_logs update policy allows staff roles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing trip_logs update policy: %', SQLERRM;
END $$;
