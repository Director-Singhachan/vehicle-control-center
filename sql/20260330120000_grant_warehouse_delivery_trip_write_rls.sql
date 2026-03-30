-- Sync with supabase/migrations/20260330120000_grant_warehouse_delivery_trip_write_rls.sql
-- Run on Supabase SQL Editor if migrations are applied manually from sql/

BEGIN;

DROP POLICY IF EXISTS "delivery_trips_insert" ON public.delivery_trips;
CREATE POLICY "delivery_trips_insert"
ON public.delivery_trips
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
);

DROP POLICY IF EXISTS "delivery_trips_update" ON public.delivery_trips;
CREATE POLICY "delivery_trips_update"
ON public.delivery_trips
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
  OR driver_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
  OR driver_id = auth.uid()
);

DROP POLICY IF EXISTS "delivery_trip_stores_insert" ON public.delivery_trip_stores;
CREATE POLICY "delivery_trip_stores_insert"
ON public.delivery_trip_stores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
);

DROP POLICY IF EXISTS "delivery_trip_stores_update" ON public.delivery_trip_stores;
CREATE POLICY "delivery_trip_stores_update"
ON public.delivery_trip_stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
);

DROP POLICY IF EXISTS "delivery_trip_stores_delete" ON public.delivery_trip_stores;
CREATE POLICY "delivery_trip_stores_delete"
ON public.delivery_trip_stores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
);

DROP POLICY IF EXISTS "delivery_trip_items_insert" ON public.delivery_trip_items;
CREATE POLICY "delivery_trip_items_insert"
ON public.delivery_trip_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
);

DROP POLICY IF EXISTS "delivery_trip_items_update" ON public.delivery_trip_items;
CREATE POLICY "delivery_trip_items_update"
ON public.delivery_trip_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
);

DROP POLICY IF EXISTS "delivery_trip_items_delete" ON public.delivery_trip_items;
CREATE POLICY "delivery_trip_items_delete"
ON public.delivery_trip_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse')
  )
);

DROP POLICY IF EXISTS delivery_trip_crews_insert ON public.delivery_trip_crews;
CREATE POLICY delivery_trip_crews_insert ON public.delivery_trip_crews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'warehouse')
    )
  );

DROP POLICY IF EXISTS delivery_trip_crews_update ON public.delivery_trip_crews;
CREATE POLICY delivery_trip_crews_update ON public.delivery_trip_crews
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'warehouse')
    )
  );

DROP POLICY IF EXISTS delivery_trip_item_changes_insert ON public.delivery_trip_item_changes;
CREATE POLICY delivery_trip_item_changes_insert ON public.delivery_trip_item_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'warehouse')
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trip_edit_history'
  ) THEN
    DROP POLICY IF EXISTS "trip_edit_history_insert" ON public.trip_edit_history;
    CREATE POLICY "trip_edit_history_insert" ON public.trip_edit_history
      FOR INSERT
      TO authenticated
      WITH CHECK (
        edited_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'manager', 'inspector', 'warehouse')
        )
      );
  END IF;
END $$;

COMMIT;
