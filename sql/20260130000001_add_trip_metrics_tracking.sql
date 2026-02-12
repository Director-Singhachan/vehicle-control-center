-- ========================================
-- Trip Metrics Tracking (AI Trip Optimization - Data Collection)
-- เพิ่มคอลัมน์และตารางสำหรับเก็บ metrics หลังจบทริป
-- ========================================

-- 1. เพิ่มคอลัมน์ metrics ใน delivery_trips
ALTER TABLE public.delivery_trips
ADD COLUMN IF NOT EXISTS actual_pallets_used INTEGER,
ADD COLUMN IF NOT EXISTS actual_weight_kg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS space_utilization_percent DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS packing_efficiency_score DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS had_packing_issues BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS packing_issues_notes TEXT,
ADD COLUMN IF NOT EXISTS actual_distance_km DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS actual_duration_hours DECIMAL(5, 2);

COMMENT ON COLUMN public.delivery_trips.actual_pallets_used IS 'จำนวนพาเลทที่ใช้จริง';
COMMENT ON COLUMN public.delivery_trips.actual_weight_kg IS 'น้ำหนักจริงที่บรรทุก (กก.)';
COMMENT ON COLUMN public.delivery_trips.space_utilization_percent IS '% การใช้พื้นที่ (0-100)';
COMMENT ON COLUMN public.delivery_trips.packing_efficiency_score IS 'คะแนนประสิทธิภาพการจัดเรียง (0-100)';
COMMENT ON COLUMN public.delivery_trips.had_packing_issues IS 'มีปัญหาการจัดเรียงหรือไม่';
COMMENT ON COLUMN public.delivery_trips.packing_issues_notes IS 'รายละเอียดปัญหา';
COMMENT ON COLUMN public.delivery_trips.actual_distance_km IS 'ระยะทางจริง (กม.)';
COMMENT ON COLUMN public.delivery_trips.actual_duration_hours IS 'เวลาที่ใช้จริง (ชม.)';

-- 2. ตารางเก็บ snapshot การจัดเรียงจริง (สำหรับ ML training)
CREATE TABLE IF NOT EXISTS public.trip_packing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,

  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  packing_layout JSONB NOT NULL,
  pallets_used INTEGER NOT NULL,
  weight_kg DECIMAL(10, 2) NOT NULL,
  volume_used_liter DECIMAL(10, 2) NOT NULL,
  utilization_percent DECIMAL(5, 2) NOT NULL,

  captured_at TIMESTAMPTZ DEFAULT NOW(),
  captured_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_trip_packing_snapshots_trip_id ON public.trip_packing_snapshots(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_packing_snapshots_vehicle_id ON public.trip_packing_snapshots(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trip_packing_snapshots_captured_at ON public.trip_packing_snapshots(captured_at);

COMMENT ON TABLE public.trip_packing_snapshots IS 'Snapshot การจัดเรียงจริงต่อทริป (สำหรับ ML)';

-- RLS สำหรับ trip_packing_snapshots
ALTER TABLE public.trip_packing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_packing_snapshots_select ON public.trip_packing_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY trip_packing_snapshots_insert ON public.trip_packing_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
  );

CREATE POLICY trip_packing_snapshots_update ON public.trip_packing_snapshots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
  );

CREATE POLICY trip_packing_snapshots_delete ON public.trip_packing_snapshots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
