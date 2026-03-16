-- 20260316000005_pnl_branch_policies.sql
-- RLS Policies for P&L snapshot tables with branch- / company-based access
-- - Manager: เห็นเฉพาะ branch ตัวเอง
-- - Executive: เห็นทุก branch / fleet
-- - Accounting / HR: เห็น summary ตามที่กำหนด
-- - อ้างอิงสิทธิ์จาก public.profiles.role + profiles.branch เป็นหลัก

BEGIN;

-- ─────────────────────────────────────────────────────────
-- 1. pnl_trip (Trip-level P&L)
--    - Manager: เห็นเฉพาะ branch = profiles.branch
--    - Executive: เห็นทุก branch
--    - Accounting / HR: เห็นทุก branch (ใช้ใน summary / audit)
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.pnl_trip ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pnl_trip_select ON public.pnl_trip;
CREATE POLICY pnl_trip_select ON public.pnl_trip
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.deleted_at IS NULL
        AND (
          -- Executive เห็นทุก branch
          p.role = 'executive'
          -- Manager เห็นเฉพาะ branch ตัวเอง
          OR (p.role = 'manager' AND p.branch IS NOT NULL AND p.branch = pnl_trip.branch)
          -- Accounting / HR เห็นทุก branch (ใช้สำหรับงานจัดทำงบ / HR cost)
          OR (p.role IN ('accounting', 'hr'))
        )
    )
  );

-- เขียน/แก้/ลบ: จำกัด admin / manager / accounting ตามเดิม
DROP POLICY IF EXISTS pnl_trip_insert ON public.pnl_trip;
CREATE POLICY pnl_trip_insert ON public.pnl_trip
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_trip_update ON public.pnl_trip;
CREATE POLICY pnl_trip_update ON public.pnl_trip
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_trip_delete ON public.pnl_trip;
CREATE POLICY pnl_trip_delete ON public.pnl_trip
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager')
    )
  );

-- ─────────────────────────────────────────────────────────
-- 2. pnl_vehicle (Vehicle-level P&L)
--    - Manager: เห็นเฉพาะ branch = profiles.branch
--    - Executive: เห็นทุก branch
--    - Accounting / HR: เห็นทุก branch (สำหรับ cost / payroll allocation)
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.pnl_vehicle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pnl_vehicle_select ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_select ON public.pnl_vehicle
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.deleted_at IS NULL
        AND (
          p.role = 'executive'
          OR (p.role = 'manager' AND p.branch IS NOT NULL AND p.branch = pnl_vehicle.branch)
          OR (p.role IN ('accounting', 'hr'))
        )
    )
  );

DROP POLICY IF EXISTS pnl_vehicle_insert ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_insert ON public.pnl_vehicle
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_vehicle_update ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_update ON public.pnl_vehicle
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_vehicle_delete ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_delete ON public.pnl_vehicle
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager')
    )
  );

-- ─────────────────────────────────────────────────────────
-- 3. pnl_fleet (Fleet/company-level P&L)
--    - Executive: เห็นทุก scope (company / branch / owner_group)
--    - Manager: เห็นเฉพาะ scope_type = 'branch' + scope_key = profiles.branch
--    - Accounting / HR: เห็นเฉพาะ company/branch summary
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.pnl_fleet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pnl_fleet_select ON public.pnl_fleet;
CREATE POLICY pnl_fleet_select ON public.pnl_fleet
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.deleted_at IS NULL
        AND (
          -- Executive เห็นทุกมิติ (company / branch / owner_group / custom)
          p.role = 'executive'
          -- Manager เห็นเฉพาะ branch ของตัวเอง (scope_type = 'branch')
          OR (
            p.role = 'manager'
            AND pnl_fleet.scope_type = 'branch'
            AND p.branch IS NOT NULL
            AND pnl_fleet.scope_key = p.branch
          )
          -- Accounting / HR เห็นสรุปที่ level company/branch เท่านั้น
          OR (
            p.role IN ('accounting', 'hr')
            AND pnl_fleet.scope_type IN ('company', 'branch')
          )
        )
    )
  );

DROP POLICY IF EXISTS pnl_fleet_insert ON public.pnl_fleet;
CREATE POLICY pnl_fleet_insert ON public.pnl_fleet
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_fleet_update ON public.pnl_fleet;
CREATE POLICY pnl_fleet_update ON public.pnl_fleet
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_fleet_delete ON public.pnl_fleet;
CREATE POLICY pnl_fleet_delete ON public.pnl_fleet
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager')
    )
  );

COMMIT;

