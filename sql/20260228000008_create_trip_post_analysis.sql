-- ========================================
-- Post-Trip Analysis Table
-- เก็บผลการวิเคราะห์ทริปหลังจบ (AI Insight)
-- ========================================

CREATE TABLE IF NOT EXISTS public.trip_post_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL, -- เช่น 'utilization', 'packing_issue', 'unload_efficiency', 'overall'
  ai_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_post_analysis_trip_id ON public.trip_post_analysis(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_post_analysis_type ON public.trip_post_analysis(analysis_type);

COMMENT ON TABLE public.trip_post_analysis IS 'ผลการวิเคราะห์ทริปหลังจบ (AI Insight ต่อทริป)';
COMMENT ON COLUMN public.trip_post_analysis.analysis_type IS 'ประเภทการวิเคราะห์ เช่น utilization, packing_issue, unload_efficiency, overall';
COMMENT ON COLUMN public.trip_post_analysis.ai_summary IS 'ข้อความสรุปจาก AI (สำหรับอ่านและปรับปรุงระบบ)';

-- Enable RLS
ALTER TABLE public.trip_post_analysis ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่ authenticated สามารถอ่านผลวิเคราะห์ได้
CREATE POLICY trip_post_analysis_select ON public.trip_post_analysis
  FOR SELECT TO authenticated
  USING (true);

-- จำกัดสิทธิ์สร้าง/แก้ไข/ลบ สำหรับบทบาทที่มีสิทธิ์ (เช่น admin, manager, inspector)
CREATE POLICY trip_post_analysis_insert ON public.trip_post_analysis
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY trip_post_analysis_update ON public.trip_post_analysis
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY trip_post_analysis_delete ON public.trip_post_analysis
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

