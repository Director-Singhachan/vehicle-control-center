-- Migration: P&L Snapshot Tables + Cost Allocation Rules (Vehicle/Trip/Fleet)
-- Scope:
--   - Data model for:
--       1) Allocation rules (fixed/variable/overhead costs)
--       2) Trip-level P&L snapshots
--       3) Vehicle-level P&L snapshots
--       4) Fleet/company-level P&L snapshots
--   - Focus on schema for calculation + historical analysis
--   - Detailed RLS policies will be added in separate migrations

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. Cost Allocation Rules
--    ใช้เก็บกติกาการปันส่วนต้นทุนจาก HR/Purchasing/Overhead ไปยัง Trip / Vehicle / Fleet
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cost_allocation_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cost_category    TEXT        NOT NULL, -- เช่น 'driver_salary', 'yard_rent', 'insurance_overhead'
  allocation_basis TEXT        NOT NULL, -- เช่น 'per_vehicle', 'per_trip', 'per_revenue', 'per_vehicle_in_branch', 'per_revenue_share'
  dimension        TEXT        NOT NULL, -- เช่น 'branch', 'fleet', 'company', 'global'

  -- JSON config เก็บรายละเอียดสูตร เช่น weight ต่อสาขา, เงื่อนไขเฉพาะ
  rule_config      JSONB       DEFAULT '{}'::jsonb,

  effective_from   DATE        NOT NULL,
  effective_to     DATE,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT cost_allocation_rules_daterange
    CHECK (effective_to IS NULL OR effective_to >= effective_from),

  CONSTRAINT cost_allocation_rules_basis_check
    CHECK (allocation_basis IN (
      'per_vehicle',
      'per_trip',
      'per_revenue',
      'per_vehicle_in_branch',
      'per_revenue_share'
    )),

  CONSTRAINT cost_allocation_rules_dimension_check
    CHECK (dimension IN (
      'branch',
      'fleet',
      'company',
      'global'
    ))
);

COMMENT ON TABLE public.cost_allocation_rules IS
  'กติกาการปันส่วนต้นทุน (fixed/variable/overhead) ตามมิติ branch/fleet/company พร้อมช่วงเวลาและ config แบบ JSON';
COMMENT ON COLUMN public.cost_allocation_rules.cost_category IS
  'หมวดต้นทุน เช่น driver_salary, yard_rent, insurance_overhead, admin_overhead';
COMMENT ON COLUMN public.cost_allocation_rules.allocation_basis IS
  'ฐานปันส่วน เช่น per_vehicle, per_trip, per_revenue, per_vehicle_in_branch, per_revenue_share';
COMMENT ON COLUMN public.cost_allocation_rules.dimension IS
  'มิติที่ใช้ปันส่วน เช่น branch, fleet, company, global';

CREATE INDEX IF NOT EXISTS idx_cost_allocation_rules_effective
  ON public.cost_allocation_rules (effective_from, effective_to)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_cost_allocation_rules_category_basis
  ON public.cost_allocation_rules (cost_category, allocation_basis);

-- เปิดใช้ RLS แต่ยังไม่กำหนด Policy (ให้ default = deny all ยกเว้น service role)
ALTER TABLE public.cost_allocation_rules ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────────────────────
-- 2. Trip-level P&L Snapshots
--    หนึ่งแถวต่อ 1 ทริป (delivery_trip) ต่อรอบการคำนวณ
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pnl_trip (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  delivery_trip_id       UUID        NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  vehicle_id             UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  branch                 TEXT,

  -- ช่วงเวลาที่ใช้สำหรับ snapshot (ส่วนใหญ่ = วันของ trip แต่เปิดไว้รองรับ use case อื่น)
  period_start           DATE        NOT NULL,
  period_end             DATE        NOT NULL,

  revenue                NUMERIC(14,2) NOT NULL DEFAULT 0,
  fixed_cost_allocated   NUMERIC(14,2) NOT NULL DEFAULT 0,
  variable_cost          NUMERIC(14,2) NOT NULL DEFAULT 0,
  idle_cost              NUMERIC(14,2) NOT NULL DEFAULT 0,

  total_cost             NUMERIC(14,2) NOT NULL DEFAULT 0,
  profit                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  margin_percent         NUMERIC(7,4), -- 0-1 หรือ 0-100 แล้วแต่ service คำนวณ

  calculated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_batch_id   UUID, -- อ้างอิง background job / batch run ถ้ามี

  flags                  JSONB       DEFAULT '{}'::jsonb, -- เก็บ flag ผิดปกติ/ข้อสังเกตต่อทริป

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pnl_trip IS
  'Snapshot P&L ระดับ Trip (delivery_trip) ต่อรอบการคำนวณ เพื่อใช้ dashboard และวิเคราะห์ย้อนหลัง';

CREATE INDEX IF NOT EXISTS idx_pnl_trip_period
  ON public.pnl_trip (period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_pnl_trip_vehicle
  ON public.pnl_trip (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_pnl_trip_branch
  ON public.pnl_trip (branch);

CREATE INDEX IF NOT EXISTS idx_pnl_trip_delivery_trip
  ON public.pnl_trip (delivery_trip_id);

ALTER TABLE public.pnl_trip ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────────────────────
-- 3. Vehicle-level P&L Snapshots
--    หนึ่งแถวต่อรถหนึ่งคันต่อช่วงเวลา (เช่น เดือน)
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pnl_vehicle (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vehicle_id       UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  branch           TEXT,

  -- ช่วงเวลา เช่น เดือน (period_start เป็นวันแรกของเดือน, period_end เป็นวันสุดท้าย)
  period_start     DATE        NOT NULL,
  period_end       DATE        NOT NULL,

  revenue          NUMERIC(14,2) NOT NULL DEFAULT 0,
  fixed_cost       NUMERIC(14,2) NOT NULL DEFAULT 0,
  variable_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
  idle_cost        NUMERIC(14,2) NOT NULL DEFAULT 0,

  total_cost       NUMERIC(14,2) NOT NULL DEFAULT 0,
  profit           NUMERIC(14,2) NOT NULL DEFAULT 0,
  margin_percent   NUMERIC(7,4),

  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_batch_id UUID,

  flags            JSONB       DEFAULT '{}'::jsonb,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pnl_vehicle IS
  'Snapshot P&L ระดับรถแต่ละคันต่อช่วงเวลา (เช่น เดือน) สำหรับดูประสิทธิภาพรายคันและ historical analysis';

CREATE INDEX IF NOT EXISTS idx_pnl_vehicle_period
  ON public.pnl_vehicle (period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_pnl_vehicle_vehicle
  ON public.pnl_vehicle (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_pnl_vehicle_branch
  ON public.pnl_vehicle (branch);

ALTER TABLE public.pnl_vehicle ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────────────────────
-- 4. Fleet/Company-level P&L Snapshots
--    ใช้สรุปภาพรวมทั้งกองรถ/บริษัท/กลุ่มสาขา
--    รองรับมิติต่าง ๆ ผ่าน scope_type + scope_key (ยืดหยุ่นกว่าการ fix fleet_id/company_id ตอนนี้)
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pnl_fleet (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ตัวบ่งชี้มิติ เช่น company, branch, owner_group, custom
  scope_type       TEXT        NOT NULL,
  scope_key        TEXT        NOT NULL,

  -- ตัวอย่าง:
  --   scope_type = 'company', scope_key = 'thaikit_logistics'
  --   scope_type = 'branch',  scope_key = '(branch code)'
  --   scope_type = 'owner_group', scope_key = 'thaikit'/'rental'

  period_start     DATE        NOT NULL,
  period_end       DATE        NOT NULL,

  total_revenue    NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_cost       NUMERIC(16,2) NOT NULL DEFAULT 0,
  profit           NUMERIC(16,2) NOT NULL DEFAULT 0,
  margin_percent   NUMERIC(7,4),

  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_batch_id UUID,

  flags            JSONB       DEFAULT '{}'::jsonb,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pnl_fleet_scope_check
    CHECK (scope_type IN ('company', 'branch', 'owner_group', 'custom'))
);

COMMENT ON TABLE public.pnl_fleet IS
  'Snapshot P&L ระดับ Fleet/บริษัท/กลุ่มสาขา ต่อช่วงเวลา สำหรับ Fleet Overview Dashboard และการวิเคราะห์ภาพรวม';

CREATE INDEX IF NOT EXISTS idx_pnl_fleet_scope_period
  ON public.pnl_fleet (scope_type, scope_key, period_start, period_end);

ALTER TABLE public.pnl_fleet ENABLE ROW LEVEL SECURITY;

