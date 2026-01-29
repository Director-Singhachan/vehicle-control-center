-- ========================================
-- สร้างตาราง Vehicle Loading Templates
-- เก็บเทมเพลตการจัดเรียงสินค้าที่ AI เรียนรู้มา
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicle_loading_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,                               -- ชื่อเทมเพลต (เช่น "จัดเต็ม", "สินค้าเบา")
  description TEXT,
  
  -- ข้อมูลการจัดเรียง (JSON)
  layout_config JSONB NOT NULL,                              -- รูปแบบการจัดเรียง
  
  -- สถิติ
  total_items_packed INTEGER,                                -- จำนวนสินค้าที่จัดได้
  utilization_percentage DECIMAL(5, 2),                     -- % การใช้พื้นที่
  weight_utilization_percentage DECIMAL(5, 2),              -- % การใช้น้ำหนัก
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(vehicle_id, template_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_loading_templates_vehicle ON public.vehicle_loading_templates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_loading_templates_active ON public.vehicle_loading_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_loading_templates_utilization ON public.vehicle_loading_templates(utilization_percentage DESC);

-- Comments
COMMENT ON TABLE public.vehicle_loading_templates IS 'ตารางเก็บเทมเพลตการจัดเรียงสินค้าที่ AI เรียนรู้มา';
COMMENT ON COLUMN public.vehicle_loading_templates.template_name IS 'ชื่อเทมเพลต (เช่น "จัดเต็ม", "สินค้าเบา")';
COMMENT ON COLUMN public.vehicle_loading_templates.layout_config IS 'รูปแบบการจัดเรียง (JSON) - ตัวอย่าง: {"zones": [{"zone_id": "front-left", "x": 0, "y": 0, "z": 0, "width": 100, "depth": 150, "height": 120, "items": [...]}], "total_volume_used": 500000, "total_weight_used": 800}';
COMMENT ON COLUMN public.vehicle_loading_templates.total_items_packed IS 'จำนวนสินค้าที่จัดได้';
COMMENT ON COLUMN public.vehicle_loading_templates.utilization_percentage IS '% การใช้พื้นที่ (0-100)';
COMMENT ON COLUMN public.vehicle_loading_templates.weight_utilization_percentage IS '% การใช้น้ำหนัก (0-100)';

-- Trigger: Update updated_at
CREATE OR REPLACE FUNCTION update_vehicle_loading_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vehicle_loading_templates_updated_at ON public.vehicle_loading_templates;
CREATE TRIGGER trigger_update_vehicle_loading_templates_updated_at
  BEFORE UPDATE ON public.vehicle_loading_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_loading_templates_updated_at();

-- RLS Policies
ALTER TABLE public.vehicle_loading_templates ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่ authenticated สามารถดูเทมเพลตได้
CREATE POLICY "Allow authenticated users to view loading templates"
  ON public.vehicle_loading_templates FOR SELECT
  TO authenticated
  USING (true);

-- Admin/Manager เท่านั้นที่สามารถจัดการเทมเพลตได้
CREATE POLICY "Allow admins to manage loading templates"
  ON public.vehicle_loading_templates FOR ALL
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
