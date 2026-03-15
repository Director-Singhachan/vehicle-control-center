-- Migration: Staff Salaries (HR) — เก็บเงินเดือนรายเดือนต่อพนักงาน สำหรับคำนวณต้นทุนบุคลากรต่อเที่ยว
-- Plan: เงินเดือนอยู่ฝั่ง HR；ดึงไปใช้ใน Trip/Vehicle P&L ตาม delivery_trip_crews + จำนวนวันเที่ยว

-- ─── 1. staff_salaries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_salaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE CASCADE,
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  monthly_salary  NUMERIC(12,2) NOT NULL CHECK (monthly_salary >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT staff_salaries_daterange CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_staff_salaries_staff_id ON public.staff_salaries(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_salaries_effective ON public.staff_salaries(effective_from, effective_to);

COMMENT ON TABLE public.staff_salaries IS 'เงินเดือน/ค่าจ้างรายเดือนต่อพนักงาน (service_staff) — ใช้คำนวณต้นทุนบุคลากรต่อเที่ยวใน P&L';
COMMENT ON COLUMN public.staff_salaries.effective_from IS 'วันเริ่มใช้อัตรานี้';
COMMENT ON COLUMN public.staff_salaries.effective_to IS 'วันสิ้นสุด (null = ยังใช้อยู่)';
COMMENT ON COLUMN public.staff_salaries.monthly_salary IS 'เงินเดือนรายเดือน (บาท)';

-- ─── 2. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_salaries_select ON public.staff_salaries;
CREATE POLICY staff_salaries_select ON public.staff_salaries
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS staff_salaries_insert ON public.staff_salaries;
CREATE POLICY staff_salaries_insert ON public.staff_salaries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'hr', 'accounting'))
  );

DROP POLICY IF EXISTS staff_salaries_update ON public.staff_salaries;
CREATE POLICY staff_salaries_update ON public.staff_salaries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'hr', 'accounting'))
  );

DROP POLICY IF EXISTS staff_salaries_delete ON public.staff_salaries;
CREATE POLICY staff_salaries_delete ON public.staff_salaries
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'hr', 'accounting'))
  );

-- ─── 3. updated_at trigger ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_staff_salaries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_salaries_updated_at ON public.staff_salaries;
CREATE TRIGGER staff_salaries_updated_at
  BEFORE UPDATE ON public.staff_salaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_staff_salaries_updated_at();
