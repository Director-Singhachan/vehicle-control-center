-- คลังสินค้า: เปลี่ยนรถในทริป (delivery_trips.vehicle_id) ให้ครบทั้ง side-effect
-- 1) trip_logs: unlink delivery_trip_id เมื่อสลับรถ (tripCrudService.changeVehicle)
-- 2) delivery_trip_vehicle_changes: บันทึก audit การเปลี่ยนรถ
--
-- หมายเหตุ: นี่คนละเรื่องกับ "แก้ป้ายทะเบียน master" ที่ตาราง vehicles (VehicleFormView)

BEGIN;

-- ── trip_logs UPDATE: เดิม staff = manager, executive, admin, inspector เท่านั้น (sql/20260125000002) ──
DROP POLICY IF EXISTS "Drivers can update own trips" ON public.trip_logs;
CREATE POLICY "Drivers can update own trips"
  ON public.trip_logs
  FOR UPDATE
  TO authenticated
  USING (
    driver_id = (select auth.uid())
    OR public.has_role((select auth.uid()), ARRAY['manager', 'executive', 'admin', 'inspector', 'warehouse'])
  )
  WITH CHECK (
    driver_id = (select auth.uid())
    OR public.has_role((select auth.uid()), ARRAY['manager', 'executive', 'admin', 'inspector', 'warehouse'])
  );

-- ── delivery_trip_vehicle_changes INSERT: เดิม admin, manager เท่านั้น (sql/20251211000000) ──
DO $$
BEGIN
  IF to_regclass('public.delivery_trip_vehicle_changes') IS NOT NULL THEN
    DROP POLICY IF EXISTS delivery_trip_vehicle_changes_insert ON public.delivery_trip_vehicle_changes;
    CREATE POLICY delivery_trip_vehicle_changes_insert
      ON public.delivery_trip_vehicle_changes
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = (select auth.uid())
            AND role IN ('admin', 'manager', 'warehouse')
        )
      );
  END IF;
END $$;

COMMIT;
