-- ========================================
-- สร้างตาราง Pallets (พาเลท)
-- สำหรับเก็บข้อมูลพาเลทแต่ละประเภทที่ใช้ในการจัดเรียงสินค้า
-- ========================================

CREATE TABLE IF NOT EXISTS public.pallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_code TEXT NOT NULL UNIQUE,                          -- รหัสพาเลท (เช่น "PAL-STD", "PAL-EUR")
  pallet_name TEXT NOT NULL,                                 -- ชื่อพาเลท (เช่น "พาเลทมาตรฐาน", "พาเลทยุโรป")
  description TEXT,
  
  -- ขนาดพาเลท (ซม.)
  length_cm DECIMAL(10, 2) NOT NULL,                         -- ความยาวพาเลท
  width_cm DECIMAL(10, 2) NOT NULL,                          -- ความกว้างพาเลท
  height_cm DECIMAL(10, 2) NOT NULL DEFAULT 15,              -- ความสูงพาเลทเปล่า (ซม.) - ปกติประมาณ 15 ซม.
  
  -- น้ำหนัก
  weight_kg DECIMAL(10, 2) DEFAULT 0,                       -- น้ำหนักพาเลทเปล่า (กก.)
  
  -- ข้อมูลการซ้อน
  max_stack_height_cm DECIMAL(10, 2),                        -- ความสูงสูงสุดที่ซ้อนได้ (รวมพาเลท + สินค้า)
  max_stack_count INTEGER DEFAULT 1,                         -- จำนวนพาเลทที่ซ้อนได้สูงสุด
  max_weight_per_pallet_kg DECIMAL(10, 2),                  -- น้ำหนักสูงสุดต่อพาเลท (กก.) - รวมสินค้า
  
  -- ข้อมูลสินค้าบนพาเลท
  items_per_pallet INTEGER,                                  -- จำนวนสินค้าต่อพาเลท (ถ้าคงที่)
  pallet_layout_config JSONB,                                -- รูปแบบการจัดเรียงสินค้าบนพาเลท (JSON)
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pallets_code ON public.pallets(pallet_code);
CREATE INDEX IF NOT EXISTS idx_pallets_active ON public.pallets(is_active);
CREATE INDEX IF NOT EXISTS idx_pallets_name ON public.pallets(pallet_name);

-- Comments
COMMENT ON TABLE public.pallets IS 'ตารางเก็บข้อมูลพาเลทแต่ละประเภทที่ใช้ในการจัดเรียงสินค้า';
COMMENT ON COLUMN public.pallets.pallet_code IS 'รหัสพาเลท (เช่น "PAL-STD", "PAL-EUR")';
COMMENT ON COLUMN public.pallets.pallet_name IS 'ชื่อพาเลท (เช่น "พาเลทมาตรฐาน", "พาเลทยุโรป")';
COMMENT ON COLUMN public.pallets.length_cm IS 'ความยาวพาเลท (ซม.)';
COMMENT ON COLUMN public.pallets.width_cm IS 'ความกว้างพาเลท (ซม.)';
COMMENT ON COLUMN public.pallets.height_cm IS 'ความสูงพาเลทเปล่า (ซม.) - ปกติประมาณ 15 ซม.';
COMMENT ON COLUMN public.pallets.weight_kg IS 'น้ำหนักพาเลทเปล่า (กก.)';
COMMENT ON COLUMN public.pallets.max_stack_height_cm IS 'ความสูงสูงสุดที่ซ้อนได้ (รวมพาเลท + สินค้า)';
COMMENT ON COLUMN public.pallets.max_stack_count IS 'จำนวนพาเลทที่ซ้อนได้สูงสุด';
COMMENT ON COLUMN public.pallets.max_weight_per_pallet_kg IS 'น้ำหนักสูงสุดต่อพาเลท (กก.) - รวมสินค้า';
COMMENT ON COLUMN public.pallets.items_per_pallet IS 'จำนวนสินค้าต่อพาเลท (ถ้าคงที่)';
COMMENT ON COLUMN public.pallets.pallet_layout_config IS 'รูปแบบการจัดเรียงสินค้าบนพาเลท (JSON) - ตัวอย่าง: {"layout_type": "grid", "rows": 4, "columns": 3, "items_per_pallet": 12}';

-- Trigger: Update updated_at
CREATE OR REPLACE FUNCTION update_pallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pallets_updated_at ON public.pallets;
CREATE TRIGGER trigger_update_pallets_updated_at
  BEFORE UPDATE ON public.pallets
  FOR EACH ROW
  EXECUTE FUNCTION update_pallets_updated_at();

-- RLS Policies
ALTER TABLE public.pallets ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่ authenticated สามารถดูพาเลทได้
CREATE POLICY "Allow authenticated users to view pallets"
  ON public.pallets FOR SELECT
  TO authenticated
  USING (true);

-- Admin/Manager เท่านั้นที่สามารถจัดการพาเลทได้
CREATE POLICY "Allow admins to manage pallets"
  ON public.pallets FOR ALL
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

-- Insert พาเลทมาตรฐาน (ตัวอย่าง)
INSERT INTO public.pallets (pallet_code, pallet_name, description, length_cm, width_cm, height_cm, weight_kg, max_stack_height_cm, max_stack_count, max_weight_per_pallet_kg, pallet_layout_config)
VALUES
  ('PAL-STD', 'พาเลทมาตรฐานไทย', 'พาเลทมาตรฐานขนาด 110x110 ซม.', 110, 110, 15, 25, 200, 3, 1000, '{"layout_type": "standard", "description": "พาเลทมาตรฐานไทย"}'),
  ('PAL-EUR', 'พาเลทยุโรป', 'พาเลทยุโรปขนาด 120x80 ซม.', 120, 80, 15, 20, 200, 3, 1000, '{"layout_type": "euro", "description": "พาเลทยุโรป"}'),
  ('PAL-ISO', 'พาเลท ISO', 'พาเลท ISO ขนาด 120x100 ซม.', 120, 100, 15, 22, 200, 3, 1000, '{"layout_type": "iso", "description": "พาเลท ISO"}')
ON CONFLICT (pallet_code) DO NOTHING;
