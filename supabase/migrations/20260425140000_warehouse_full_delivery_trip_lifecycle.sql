-- คลังสินค้า (warehouse): ลบ/แก้ไขทริปจัดส่งได้ครบ — RLS ระดับฐานข้อมูลให้สอดคล้อง tab.delivery_trips (manage)
-- รวมถึงลูกๆ ที่ ON DELETE CASCADE / ขั้นตอนลบทริป (orders, pnl, packing, commission_logs ฯลฯ)

BEGIN;

-- ── 1) delivery_trips: ลบทริป ──
DROP POLICY IF EXISTS "delivery_trips_delete" ON public.delivery_trips;
CREATE POLICY "delivery_trips_delete"
  ON public.delivery_trips
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role IN ('admin', 'manager', 'warehouse')
    )
  );

-- ── 2) delivery_trip_crews: ลบแถว crew (รวมถึงเส้นทางที่แยก delete) ──
DROP POLICY IF EXISTS delivery_trip_crews_delete ON public.delivery_trip_crews;
CREATE POLICY delivery_trip_crews_delete
  ON public.delivery_trip_crews
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'warehouse')
    )
  );

-- ── 3) orders: อัปเดตเว้นทริปตอนลบ (tripCrudService.delete) ──
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'user', 'sales', 'inspector', 'warehouse')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'user', 'sales', 'inspector', 'warehouse')
    )
  );

-- ── 4) trip_packing_layout / items (CASCADE จาก delivery_trips) ──
DROP POLICY IF EXISTS tpl_insert ON public.trip_packing_layout;
CREATE POLICY tpl_insert ON public.trip_packing_layout
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
    )
  );

DROP POLICY IF EXISTS tpl_update ON public.trip_packing_layout;
CREATE POLICY tpl_update ON public.trip_packing_layout
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
    )
  );

DROP POLICY IF EXISTS tpl_delete ON public.trip_packing_layout;
CREATE POLICY tpl_delete ON public.trip_packing_layout
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'warehouse')
    )
  );

DROP POLICY IF EXISTS tpli_insert ON public.trip_packing_layout_items;
CREATE POLICY tpli_insert ON public.trip_packing_layout_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
    )
    AND EXISTS (
      SELECT 1
      FROM public.trip_packing_layout tpl
      WHERE tpl.id = trip_packing_layout_id
    )
  );

DROP POLICY IF EXISTS tpli_update ON public.trip_packing_layout_items;
CREATE POLICY tpli_update ON public.trip_packing_layout_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
    )
  );

DROP POLICY IF EXISTS tpli_delete ON public.trip_packing_layout_items;
CREATE POLICY tpli_delete ON public.trip_packing_layout_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'warehouse')
    )
  );

-- ── 5) pnl_trip: CASCADE ลบ snapshot เมื่อลบ delivery_trip (ถ้ามีตาราง) ──
DO $$
BEGIN
  IF to_regclass('public.pnl_trip') IS NOT NULL THEN
    DROP POLICY IF EXISTS pnl_trip_delete ON public.pnl_trip;
    CREATE POLICY pnl_trip_delete
      ON public.pnl_trip
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = (select auth.uid())
            AND p.role IN ('admin', 'manager', 'warehouse')
        )
      );
  END IF;
END $$;

-- ── 6) trip_post_analysis (CASCADE) — บางโปรเจกต์สร้างจาก sql/ เท่านั้น ──
DO $$
BEGIN
  IF to_regclass('public.trip_post_analysis') IS NOT NULL THEN
    DROP POLICY IF EXISTS trip_post_analysis_delete ON public.trip_post_analysis;
    CREATE POLICY trip_post_analysis_delete
      ON public.trip_post_analysis
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'warehouse')
        )
      );

    DROP POLICY IF EXISTS trip_post_analysis_insert ON public.trip_post_analysis;
    CREATE POLICY trip_post_analysis_insert
      ON public.trip_post_analysis
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'inspector', 'warehouse')
        )
      );

    DROP POLICY IF EXISTS trip_post_analysis_update ON public.trip_post_analysis;
    CREATE POLICY trip_post_analysis_update
      ON public.trip_post_analysis
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'inspector', 'warehouse')
        )
      );
  END IF;
END $$;

-- ── 7) trip_packing_snapshots (CASCADE) — บางโปรเจกต์สร้างจาก sql/ เท่านั้น ──
DO $$
BEGIN
  IF to_regclass('public.trip_packing_snapshots') IS NOT NULL THEN
    DROP POLICY IF EXISTS trip_packing_snapshots_delete ON public.trip_packing_snapshots;
    CREATE POLICY trip_packing_snapshots_delete
      ON public.trip_packing_snapshots
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'warehouse')
        )
      );

    DROP POLICY IF EXISTS trip_packing_snapshots_insert ON public.trip_packing_snapshots;
    CREATE POLICY trip_packing_snapshots_insert
      ON public.trip_packing_snapshots
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
        )
      );

    DROP POLICY IF EXISTS trip_packing_snapshots_update ON public.trip_packing_snapshots;
    CREATE POLICY trip_packing_snapshots_update
      ON public.trip_packing_snapshots
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'inspector', 'driver', 'warehouse')
        )
      );
  END IF;
END $$;

-- ── 8) trip_edit_history: CASCADE ลบ audit ที่ผูก delivery_trip ──
DO $$
BEGIN
  IF to_regclass('public.trip_edit_history') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trip_edit_history') THEN
    DROP POLICY IF EXISTS "trip_edit_history delete admin only" ON public.trip_edit_history;
    CREATE POLICY "trip_edit_history delete admin only"
      ON public.trip_edit_history
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'warehouse')
        )
      );
  END IF;
END $$;

-- ── 9) commission_logs: CASCADE จาก delivery_trip หลัง 20260409120000 ──
DO $$
BEGIN
  IF to_regclass('public.commission_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS commission_logs_delete ON public.commission_logs;
    CREATE POLICY commission_logs_delete
      ON public.commission_logs
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'warehouse')
        )
      );
  END IF;
END $$;

-- ── 10) delivery_trip_item_changes: ให้ลบตาม cascade ได้ (เดิมอาจไม่มี policy DELETE) ──
DO $$
BEGIN
  IF to_regclass('public.delivery_trip_item_changes') IS NOT NULL THEN
    DROP POLICY IF EXISTS delivery_trip_item_changes_delete ON public.delivery_trip_item_changes;
    CREATE POLICY delivery_trip_item_changes_delete
      ON public.delivery_trip_item_changes
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'inspector', 'warehouse')
        )
      );
  END IF;
END $$;

COMMIT;
