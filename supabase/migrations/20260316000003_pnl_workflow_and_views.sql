-- Migration: P&L Workflow (Trip / Salary / Vehicle Costs) + Entry-Point Views + RLS for P&L Snapshots
-- Scope:
--   - Define explicit DRAFT → SUBMITTED → APPROVED workflow for HR salaries & vehicle costs
--   - Mark the points where data is considered "ready for P&L" via helper views
--   - Add initial RLS policies for pnl_trip / pnl_vehicle / pnl_fleet / cost_allocation_rules
--
-- Notes:
--   - Calculation logic (Edge Functions / background jobs) should consume ONLY the *_ready_for_pnl views
--   - This keeps the workflow explicit and auditable while preserving existing tables and UI usage

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. Workflow Columns: staff_salaries (HR)
--    DRAFT → SUBMITTED → APPROVED (+ CANCELLED)
-- ────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_salaries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled')),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.staff_salaries.status IS
  'Workflow สถานะ: draft → submitted → approved / cancelled สำหรับควบคุมจุดที่เงินเดือนถูกนำเข้า P&L';
COMMENT ON COLUMN public.staff_salaries.submitted_at IS
  'เวลา HR ส่งรายการเงินเดือนไปขออนุมัติ (เปลี่ยนจาก draft → submitted)';
COMMENT ON COLUMN public.staff_salaries.submitted_by IS
  'ผู้ส่งรายการเงินเดือนไปขออนุมัติ';
COMMENT ON COLUMN public.staff_salaries.approved_at IS
  'เวลาอนุมัติเงินเดือนรอบนั้น (เมื่อ approved แล้วจึงถูกนำไปใช้ใน P&L)';
COMMENT ON COLUMN public.staff_salaries.approved_by IS
  'ผู้อนุมัติรายการเงินเดือนรอบนั้น';


-- ────────────────────────────────────────────────────────────────────────────────
-- 2. Workflow Columns: vehicle_fixed_costs / vehicle_variable_costs
--    DRAFT → SUBMITTED → APPROVED (+ CANCELLED)
-- ────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.vehicle_fixed_costs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled')),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vehicle_fixed_costs.status IS
  'Workflow สถานะ: draft → submitted → approved / cancelled; เฉพาะ approved เท่านั้นที่ถูกใช้ในการคำนวณ P&L';
COMMENT ON COLUMN public.vehicle_fixed_costs.submitted_at IS
  'เวลาที่ผู้ใช้ส่งต้นทุนคงที่ไปขออนุมัติ';
COMMENT ON COLUMN public.vehicle_fixed_costs.submitted_by IS
  'ผู้ส่งต้นทุนคงที่ไปขออนุมัติ';
COMMENT ON COLUMN public.vehicle_fixed_costs.approved_at IS
  'เวลาที่อนุมัติรายการต้นทุนคงที่';
COMMENT ON COLUMN public.vehicle_fixed_costs.approved_by IS
  'ผู้อนุมัติรายการต้นทุนคงที่';


ALTER TABLE public.vehicle_variable_costs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled')),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vehicle_variable_costs.status IS
  'Workflow สถานะ: draft → submitted → approved / cancelled; เฉพาะ approved เท่านั้นที่ถูกใช้ในการคำนวณ P&L';
COMMENT ON COLUMN public.vehicle_variable_costs.submitted_at IS
  'เวลาที่ผู้ใช้ส่งต้นทุนผันแปรไปขออนุมัติ';
COMMENT ON COLUMN public.vehicle_variable_costs.submitted_by IS
  'ผู้ส่งต้นทุนผันแปรไปขออนุมัติ';
COMMENT ON COLUMN public.vehicle_variable_costs.approved_at IS
  'เวลาที่อนุมัติรายการต้นทุนผันแปร';
COMMENT ON COLUMN public.vehicle_variable_costs.approved_by IS
  'ผู้อนุมัติรายการต้นทุนผันแปร';


-- ────────────────────────────────────────────────────────────────────────────────
-- 3. Trip Workflow → P&L Entry Point
--    ใช้สถานะ delivery_trips.status = 'completed' เป็นจุดตัดว่าเที่ยวนี้ "ปิดยอด" และพร้อมเข้าระบบ P&L
-- ────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.delivery_trips_ready_for_pnl AS
SELECT
  dt.id,
  dt.trip_number,
  dt.vehicle_id,
  dt.driver_id,
  dt.planned_date,
  dt.trip_start_date,
  dt.trip_end_date,
  dt.status,
  dt.trip_revenue,
  dt.created_at,
  dt.updated_at
FROM public.delivery_trips dt
WHERE dt.status = 'completed';

COMMENT ON VIEW public.delivery_trips_ready_for_pnl IS
  'ทริปที่ปิดงานแล้ว (status = completed) และพร้อมถูกนำไปใช้คำนวณ P&L ระดับ Trip/Vehicle/Fleet';

-- Ensure the view executes with the querying user's privileges
ALTER VIEW public.delivery_trips_ready_for_pnl
  SET (security_invoker = on);


-- ────────────────────────────────────────────────────────────────────────────────
-- 4. Salary / Vehicle Cost Entry-Point Views
--    เฉพาะรายการที่ผ่านการอนุมัติ (status = approved) เท่านั้นที่เข้าสูตร P&L
-- ────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.staff_salaries_ready_for_pnl AS
SELECT
  ss.*
FROM public.staff_salaries ss
WHERE ss.status = 'approved';

COMMENT ON VIEW public.staff_salaries_ready_for_pnl IS
  'เงินเดือนพนักงาน (staff_salaries) ที่ผ่านการอนุมัติแล้ว (status = approved) และพร้อมใช้ในการปันส่วนต้นทุนไปยัง Trip/Vehicle P&L';

ALTER VIEW public.staff_salaries_ready_for_pnl
  SET (security_invoker = on);


CREATE OR REPLACE VIEW public.vehicle_fixed_costs_ready_for_pnl AS
SELECT
  vfc.*
FROM public.vehicle_fixed_costs vfc
WHERE vfc.status = 'approved';

COMMENT ON VIEW public.vehicle_fixed_costs_ready_for_pnl IS
  'ต้นทุนคงที่ของรถ (vehicle_fixed_costs) ที่ผ่านการอนุมัติแล้ว (status = approved) สำหรับใช้ใน P&L';

ALTER VIEW public.vehicle_fixed_costs_ready_for_pnl
  SET (security_invoker = on);


CREATE OR REPLACE VIEW public.vehicle_variable_costs_ready_for_pnl AS
SELECT
  vvc.*
FROM public.vehicle_variable_costs vvc
WHERE vvc.status = 'approved';

COMMENT ON VIEW public.vehicle_variable_costs_ready_for_pnl IS
  'ต้นทุนผันแปรของรถ (vehicle_variable_costs) ที่ผ่านการอนุมัติแล้ว (status = approved) สำหรับใช้ใน P&L';

ALTER VIEW public.vehicle_variable_costs_ready_for_pnl
  SET (security_invoker = on);


-- ────────────────────────────────────────────────────────────────────────────────
-- 5. RLS Policies: cost_allocation_rules
--    HR / Accounting / Admin / Manager สามารถบริหารกติกาการปันส่วนได้
-- ────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cost_allocation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_allocation_rules_select ON public.cost_allocation_rules;
CREATE POLICY cost_allocation_rules_select ON public.cost_allocation_rules
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS cost_allocation_rules_insert ON public.cost_allocation_rules;
CREATE POLICY cost_allocation_rules_insert ON public.cost_allocation_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting', 'hr')
    )
  );

DROP POLICY IF EXISTS cost_allocation_rules_update ON public.cost_allocation_rules;
CREATE POLICY cost_allocation_rules_update ON public.cost_allocation_rules
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting', 'hr')
    )
  );

DROP POLICY IF EXISTS cost_allocation_rules_delete ON public.cost_allocation_rules;
CREATE POLICY cost_allocation_rules_delete ON public.cost_allocation_rules
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );


-- ────────────────────────────────────────────────────────────────────────────────
-- 6. RLS Policies: P&L Snapshot Tables (pnl_trip / pnl_vehicle / pnl_fleet)
--    - ทุก role ที่ authenticated สามารถอ่านได้ (สำหรับ Dashboard)
--    - เฉพาะระบบเบื้องหลัง (admin/manager/accounting) ที่สามารถเขียน/แก้ไข
-- ────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pnl_trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnl_vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnl_fleet ENABLE ROW LEVEL SECURITY;

-- pnl_trip
DROP POLICY IF EXISTS pnl_trip_select ON public.pnl_trip;
CREATE POLICY pnl_trip_select ON public.pnl_trip
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS pnl_trip_insert ON public.pnl_trip;
CREATE POLICY pnl_trip_insert ON public.pnl_trip
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_trip_update ON public.pnl_trip;
CREATE POLICY pnl_trip_update ON public.pnl_trip
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_trip_delete ON public.pnl_trip;
CREATE POLICY pnl_trip_delete ON public.pnl_trip
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );


-- pnl_vehicle
DROP POLICY IF EXISTS pnl_vehicle_select ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_select ON public.pnl_vehicle
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS pnl_vehicle_insert ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_insert ON public.pnl_vehicle
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_vehicle_update ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_update ON public.pnl_vehicle
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_vehicle_delete ON public.pnl_vehicle;
CREATE POLICY pnl_vehicle_delete ON public.pnl_vehicle
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );


-- pnl_fleet
DROP POLICY IF EXISTS pnl_fleet_select ON public.pnl_fleet;
CREATE POLICY pnl_fleet_select ON public.pnl_fleet
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS pnl_fleet_insert ON public.pnl_fleet;
CREATE POLICY pnl_fleet_insert ON public.pnl_fleet
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_fleet_update ON public.pnl_fleet;
CREATE POLICY pnl_fleet_update ON public.pnl_fleet
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'accounting')
    )
  );

DROP POLICY IF EXISTS pnl_fleet_delete ON public.pnl_fleet;
CREATE POLICY pnl_fleet_delete ON public.pnl_fleet
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );

