-- Migration: Vehicle fixed/variable costs (P&L Phase 1) + trip revenue/dates on delivery_trips
-- Plan: ต้นทุนคงที่-ผันแปร และตัวชี้ต่อกม./เที่ยว/ชิ้น — Phase 1 Schema

-- ─── 1. delivery_trips: เพิ่มฟิลด์รายได้และวันเที่ยว ─────────────────────────
ALTER TABLE public.delivery_trips
  ADD COLUMN IF NOT EXISTS trip_revenue    NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trip_start_date DATE         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trip_end_date   DATE         DEFAULT NULL;

COMMENT ON COLUMN public.delivery_trips.trip_revenue    IS 'รายได้ของเที่ยว (บาท): หลัก = กำไรจากสินค้าทั้งหมดในเที่ยวที่ไปส่ง；รอง = ค่าจ้างส่งเป็นค่าเที่ยวเมื่อจ้างส่ง。ไม่กรอกได้ — คำนวณจาก orders/กำไรสินค้าได้';
COMMENT ON COLUMN public.delivery_trips.trip_start_date IS 'วันเริ่มเที่ยว — สำหรับคำนวณจำนวนวันของเที่ยว';
COMMENT ON COLUMN public.delivery_trips.trip_end_date   IS 'วันสิ้นสุดเที่ยว';

-- ─── 2. vehicle_fixed_costs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_fixed_costs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  cost_type    TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  period_type  TEXT NOT NULL CHECK (period_type IN ('monthly', 'yearly')),
  period_start DATE NOT NULL,
  period_end   DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.vehicle_fixed_costs IS 'ต้นทุนคงที่ต่อรถต่อช่วง (ค่างวด, เงินเดือน, ระบบ/GPS ฯลฯ)；ภาษี/ประกันดึงจากตารางเดิมใน Service';
COMMENT ON COLUMN public.vehicle_fixed_costs.cost_type   IS 'เช่น ค่างวด, ภาษี, ประกัน, เงินเดือนคนขับ, ระบบ/GPS';
COMMENT ON COLUMN public.vehicle_fixed_costs.period_type IS 'monthly | yearly — ใช้ปันส่วนใน Service';
COMMENT ON COLUMN public.vehicle_fixed_costs.period_start IS 'วันเริ่มต้นรอบ (หรือต้นเดือน/ต้นปี)';
COMMENT ON COLUMN public.vehicle_fixed_costs.period_end   IS 'วันสิ้นสุดรอบ (nullable สำหรับรายเดือนอาจใช้แค่ period_start)';

CREATE INDEX IF NOT EXISTS idx_vehicle_fixed_costs_vehicle_id ON public.vehicle_fixed_costs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_fixed_costs_period ON public.vehicle_fixed_costs(period_start, period_end);

-- ─── 3. vehicle_variable_costs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_variable_costs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  cost_type        TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  cost_date        DATE NOT NULL,
  delivery_trip_id UUID REFERENCES public.delivery_trips(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.vehicle_variable_costs IS 'ต้นทุนผันแปรต่อรถ (ทางด่วน, ปะยาง, เบี้ยเลี้ยง ฯลฯ)；ผูก delivery_trip_id เมื่อเป็นค่าใช้จ่ายจากงานวิ่ง';
COMMENT ON COLUMN public.vehicle_variable_costs.cost_type        IS 'เช่น ทางด่วน, ปะยาง, เบี้ยเลี้ยง, โอที, ค่าขนถ่าย';
COMMENT ON COLUMN public.vehicle_variable_costs.delivery_trip_id IS 'ผูกเที่ยวเมื่อ cost เกิดจากงานวิ่ง；ว่างเมื่อเป็นซ่อมบำรุงทั่วไป';

CREATE INDEX IF NOT EXISTS idx_vehicle_variable_costs_vehicle_id ON public.vehicle_variable_costs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_variable_costs_cost_date ON public.vehicle_variable_costs(cost_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_variable_costs_delivery_trip ON public.vehicle_variable_costs(delivery_trip_id) WHERE delivery_trip_id IS NOT NULL;

-- ─── 4. RLS: vehicle_fixed_costs ───────────────────────────────────────────────
ALTER TABLE public.vehicle_fixed_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vfc_select ON public.vehicle_fixed_costs;
CREATE POLICY vfc_select ON public.vehicle_fixed_costs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

DROP POLICY IF EXISTS vfc_insert ON public.vehicle_fixed_costs;
CREATE POLICY vfc_insert ON public.vehicle_fixed_costs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'inspector', 'accounting'))
    AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

DROP POLICY IF EXISTS vfc_update ON public.vehicle_fixed_costs;
CREATE POLICY vfc_update ON public.vehicle_fixed_costs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'inspector', 'accounting'))
    AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

DROP POLICY IF EXISTS vfc_delete ON public.vehicle_fixed_costs;
CREATE POLICY vfc_delete ON public.vehicle_fixed_costs
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

-- ─── 5. RLS: vehicle_variable_costs ────────────────────────────────────────────
ALTER TABLE public.vehicle_variable_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vvc_select ON public.vehicle_variable_costs;
CREATE POLICY vvc_select ON public.vehicle_variable_costs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

DROP POLICY IF EXISTS vvc_insert ON public.vehicle_variable_costs;
CREATE POLICY vvc_insert ON public.vehicle_variable_costs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'inspector', 'accounting', 'driver'))
    AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

DROP POLICY IF EXISTS vvc_update ON public.vehicle_variable_costs;
CREATE POLICY vvc_update ON public.vehicle_variable_costs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'inspector', 'accounting', 'driver'))
    AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

DROP POLICY IF EXISTS vvc_delete ON public.vehicle_variable_costs;
CREATE POLICY vvc_delete ON public.vehicle_variable_costs
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id)
  );

-- ─── 6. Trigger: updated_at for vehicle_fixed_costs ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicle_fixed_costs_updated_at ON public.vehicle_fixed_costs;
CREATE TRIGGER trg_vehicle_fixed_costs_updated_at
  BEFORE UPDATE ON public.vehicle_fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
