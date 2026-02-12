-- ========================================
-- สร้างตาราง AI Trip Recommendations
-- เก็บคำแนะนำการจัดทริปจาก AI
-- ========================================

CREATE TABLE IF NOT EXISTS public.ai_trip_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Input
  input_hash TEXT NOT NULL,                                  -- Hash ของ input เพื่อป้องกัน duplicate
  requested_products JSONB NOT NULL,                        -- [{product_id, quantity, store_id}]
  requested_stores JSONB NOT NULL,                          -- [{store_id, sequence_order}]
  planned_date DATE NOT NULL,
  
  -- Output: คำแนะนำ
  recommended_trips JSONB NOT NULL,                         -- [{vehicle_id, items[], layout[]}]
  total_vehicles_needed INTEGER,
  estimated_distance_km DECIMAL(10, 2),
  estimated_duration_hours DECIMAL(10, 2),
  utilization_scores JSONB,                                 -- {vehicle_id: {volume: 85, weight: 90}}
  
  -- AI Metadata
  ai_model_version TEXT,                                    -- เวอร์ชันโมเดลที่ใช้
  confidence_score DECIMAL(5, 2),                           -- ความมั่นใจ (0-100)
  reasoning TEXT,                                           -- เหตุผลที่ AI แนะนำแบบนี้
  
  -- Status
  status TEXT DEFAULT 'pending',                            -- 'pending', 'accepted', 'rejected', 'modified'
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_trip_recommendations_hash ON public.ai_trip_recommendations(input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_trip_recommendations_date ON public.ai_trip_recommendations(planned_date);
CREATE INDEX IF NOT EXISTS idx_ai_trip_recommendations_status ON public.ai_trip_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ai_trip_recommendations_created_at ON public.ai_trip_recommendations(created_at DESC);

-- Comments
COMMENT ON TABLE public.ai_trip_recommendations IS 'ตารางเก็บคำแนะนำการจัดทริปจาก AI';
COMMENT ON COLUMN public.ai_trip_recommendations.input_hash IS 'Hash ของ input เพื่อป้องกัน duplicate recommendations';
COMMENT ON COLUMN public.ai_trip_recommendations.requested_products IS 'รายการสินค้าที่ต้องการส่ง (JSON) - ตัวอย่าง: [{"product_id": "xxx", "quantity": 10, "store_id": "yyy"}]';
COMMENT ON COLUMN public.ai_trip_recommendations.requested_stores IS 'รายการร้านค้า (JSON) - ตัวอย่าง: [{"store_id": "yyy", "sequence_order": 1}]';
COMMENT ON COLUMN public.ai_trip_recommendations.recommended_trips IS 'คำแนะนำการจัดทริป (JSON) - ตัวอย่าง: [{"vehicle_id": "xxx", "stores": [...], "layout_3d": {...}}]';
COMMENT ON COLUMN public.ai_trip_recommendations.total_vehicles_needed IS 'จำนวนรถที่แนะนำ';
COMMENT ON COLUMN public.ai_trip_recommendations.estimated_distance_km IS 'ระยะทางโดยประมาณ (กม.)';
COMMENT ON COLUMN public.ai_trip_recommendations.estimated_duration_hours IS 'เวลาที่ใช้โดยประมาณ (ชม.)';
COMMENT ON COLUMN public.ai_trip_recommendations.utilization_scores IS 'คะแนนการใช้พื้นที่/น้ำหนัก (JSON) - ตัวอย่าง: {"vehicle-1": {"volume": 85, "weight": 90}}';
COMMENT ON COLUMN public.ai_trip_recommendations.ai_model_version IS 'เวอร์ชันโมเดล AI ที่ใช้ (เช่น "rule-based-v1", "ml-v2.1")';
COMMENT ON COLUMN public.ai_trip_recommendations.confidence_score IS 'ความมั่นใจของ AI (0-100)';
COMMENT ON COLUMN public.ai_trip_recommendations.reasoning IS 'เหตุผลที่ AI แนะนำแบบนี้';
COMMENT ON COLUMN public.ai_trip_recommendations.status IS 'สถานะ: pending, accepted, rejected, modified';

-- RLS Policies
ALTER TABLE public.ai_trip_recommendations ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่ authenticated สามารถดูคำแนะนำได้
CREATE POLICY "Allow authenticated users to view recommendations"
  ON public.ai_trip_recommendations FOR SELECT
  TO authenticated
  USING (true);

-- ทุกคนที่ authenticated สามารถสร้างคำแนะนำได้
CREATE POLICY "Allow authenticated users to create recommendations"
  ON public.ai_trip_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Admin/Manager เท่านั้นที่สามารถ accept/reject ได้
CREATE POLICY "Allow admins to update recommendations"
  ON public.ai_trip_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );
