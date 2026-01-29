-- ========================================
-- สร้างตาราง Product Pallet Configs
-- เก็บข้อมูลการจัดเรียงสินค้าบนพาเลทแบบละเอียด (ชั้นละกี่ลัง/ถาด, กี่ชั้น)
-- ========================================

CREATE TABLE IF NOT EXISTS public.product_pallet_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  pallet_id UUID NOT NULL REFERENCES public.pallets(id) ON DELETE CASCADE,
  
  -- ชื่อแบบจัดเรียง
  config_name TEXT NOT NULL,                                 -- เช่น "มาตรฐาน 60 ลัง", "อัดเต็ม 75 ลัง", "ถาด 126 (18x7)"
  description TEXT,                                          -- คำอธิบายเพิ่มเติม
  
  -- ข้อมูลการจัดเรียงแบบละเอียด
  layers INTEGER NOT NULL,                                    -- จำนวนชั้น (เช่น 7 ชั้น)
  units_per_layer INTEGER NOT NULL,                          -- จำนวนลัง/ถาดต่อชั้น (เช่น 18 ถาด, 20 ถาด)
  total_units INTEGER GENERATED ALWAYS AS (layers * units_per_layer) STORED, -- จำนวนรวม (คำนวณอัตโนมัติ)
  
  -- ข้อมูลขนาด/น้ำหนัก
  total_height_cm DECIMAL(10, 2),                            -- ความสูงรวม (ซม.) - รวมพาเลท + สินค้าทุกชั้น
  total_weight_kg DECIMAL(10, 2),                            -- น้ำหนักรวม (กก.) - รวมพาเลท + สินค้า
  
  -- ข้อมูลการจัดเรียงแบบละเอียด (JSON - สำหรับกรณีซับซ้อน)
  layout_details JSONB,                                      -- รายละเอียดการจัดเรียงแต่ละชั้น (JSON)
  -- ตัวอย่าง: {
  --   "layer_1": {"units": 18, "arrangement": "3x6", "notes": "ชั้นล่าง"},
  --   "layer_2": {"units": 18, "arrangement": "3x6"},
  --   ...
  -- }
  
  -- ข้อจำกัด/คุณสมบัติ
  is_default BOOLEAN DEFAULT FALSE,                          -- ใช้เป็นค่าเริ่มต้นหรือไม่
  is_safe_mode BOOLEAN DEFAULT TRUE,                         -- โหมดปลอดภัย (ไม่เสี่ยงล้ม/ยุบ)
  is_compact_mode BOOLEAN DEFAULT FALSE,                     -- โหมดอัดแน่น (ประหยัดพื้นที่)
  requires_strapping BOOLEAN DEFAULT FALSE,                   -- ต้องใช้ฟิล์มพัน/รัดหรือไม่
  requires_special_handling BOOLEAN DEFAULT FALSE,           -- ต้องจัดการพิเศษหรือไม่
  
  -- หมายเหตุ
  notes TEXT,                                                 -- หมายเหตุเพิ่มเติม (เช่น "ใช้เฉพาะลูกค้า X", "ต้องใช้ฟิล์มพันเพิ่ม")
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  
  -- Constraint: แต่ละ product + pallet + config_name ต้องไม่ซ้ำ
  UNIQUE(product_id, pallet_id, config_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_pallet_configs_product ON public.product_pallet_configs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pallet_configs_pallet ON public.product_pallet_configs(pallet_id);
CREATE INDEX IF NOT EXISTS idx_product_pallet_configs_default ON public.product_pallet_configs(product_id, pallet_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_pallet_configs_active ON public.product_pallet_configs(is_active);

-- Comments
COMMENT ON TABLE public.product_pallet_configs IS 'ตารางเก็บข้อมูลการจัดเรียงสินค้าบนพาเลทแบบละเอียด (ชั้นละกี่ลัง/ถาด, กี่ชั้น)';
COMMENT ON COLUMN public.product_pallet_configs.config_name IS 'ชื่อแบบจัดเรียง (เช่น "มาตรฐาน 60 ลัง", "อัดเต็ม 75 ลัง", "ถาด 126 (18x7)")';
COMMENT ON COLUMN public.product_pallet_configs.layers IS 'จำนวนชั้น (เช่น 7 ชั้น)';
COMMENT ON COLUMN public.product_pallet_configs.units_per_layer IS 'จำนวนลัง/ถาดต่อชั้น (เช่น 18 ถาด, 20 ถาด)';
COMMENT ON COLUMN public.product_pallet_configs.total_units IS 'จำนวนรวม (คำนวณอัตโนมัติ = layers * units_per_layer)';
COMMENT ON COLUMN public.product_pallet_configs.total_height_cm IS 'ความสูงรวม (ซม.) - รวมพาเลท + สินค้าทุกชั้น';
COMMENT ON COLUMN public.product_pallet_configs.total_weight_kg IS 'น้ำหนักรวม (กก.) - รวมพาเลท + สินค้า';
COMMENT ON COLUMN public.product_pallet_configs.layout_details IS 'รายละเอียดการจัดเรียงแต่ละชั้น (JSON) - ตัวอย่าง: {"layer_1": {"units": 18, "arrangement": "3x6"}, ...}';
COMMENT ON COLUMN public.product_pallet_configs.is_default IS 'ใช้เป็นค่าเริ่มต้นหรือไม่ (ถ้ามีหลายแบบ)';
COMMENT ON COLUMN public.product_pallet_configs.is_safe_mode IS 'โหมดปลอดภัย (ไม่เสี่ยงล้ม/ยุบ)';
COMMENT ON COLUMN public.product_pallet_configs.is_compact_mode IS 'โหมดอัดแน่น (ประหยัดพื้นที่)';
COMMENT ON COLUMN public.product_pallet_configs.requires_strapping IS 'ต้องใช้ฟิล์มพัน/รัดหรือไม่';
COMMENT ON COLUMN public.product_pallet_configs.requires_special_handling IS 'ต้องจัดการพิเศษหรือไม่';

-- Trigger: Update updated_at
CREATE OR REPLACE FUNCTION update_product_pallet_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_pallet_configs_updated_at ON public.product_pallet_configs;
CREATE TRIGGER trigger_update_product_pallet_configs_updated_at
  BEFORE UPDATE ON public.product_pallet_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_product_pallet_configs_updated_at();

-- RLS Policies
ALTER TABLE public.product_pallet_configs ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่ authenticated สามารถดู configs ได้
CREATE POLICY "Allow authenticated users to view pallet configs"
  ON public.product_pallet_configs FOR SELECT
  TO authenticated
  USING (true);

-- Admin/Manager เท่านั้นที่สามารถจัดการ configs ได้
CREATE POLICY "Allow admins to manage pallet configs"
  ON public.product_pallet_configs FOR ALL
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

-- Constraint: ถ้า is_default = TRUE สำหรับ product + pallet ต้องมีแค่ 1 แบบเท่านั้น
-- (ใช้ trigger หรือ application logic ตรวจสอบ)

-- Function: ตรวจสอบว่า product + pallet มี is_default = TRUE เกิน 1 แบบหรือไม่
CREATE OR REPLACE FUNCTION check_single_default_pallet_config()
RETURNS TRIGGER AS $$
DECLARE
  default_count INTEGER;
BEGIN
  -- ถ้า set is_default = TRUE ให้ตรวจสอบว่า product + pallet นี้มี default อื่นอยู่แล้วหรือไม่
  IF NEW.is_default = TRUE THEN
    SELECT COUNT(*) INTO default_count
    FROM public.product_pallet_configs
    WHERE product_id = NEW.product_id
      AND pallet_id = NEW.pallet_id
      AND is_default = TRUE
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF default_count > 0 THEN
      RAISE EXCEPTION 'Product + Pallet combination can only have one default config. Please set other configs to is_default = FALSE first.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: ตรวจสอบ default config
DROP TRIGGER IF EXISTS trigger_check_single_default_pallet_config ON public.product_pallet_configs;
CREATE TRIGGER trigger_check_single_default_pallet_config
  BEFORE INSERT OR UPDATE ON public.product_pallet_configs
  FOR EACH ROW
  EXECUTE FUNCTION check_single_default_pallet_config();
