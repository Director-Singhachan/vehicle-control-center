-- ========================================
-- เพิ่มข้อมูลขนาด 3D และพาเลทสำหรับสินค้า (Products)
-- สำหรับระบบ AI Trip Optimization (3D Bin Packing)
-- ========================================

-- เพิ่มคอลัมน์ขนาด 3D สำหรับสินค้า
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10, 2),           -- ความยาว (ซม.)
ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10, 2),            -- ความกว้าง (ซม.)
ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10, 2),           -- ความสูง (ซม.)
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT FALSE,   -- ของแตกง่ายหรือไม่
ADD COLUMN IF NOT EXISTS is_liquid BOOLEAN DEFAULT FALSE,    -- ของเหลวหรือไม่
ADD COLUMN IF NOT EXISTS requires_temperature TEXT,          -- อุณหภูมิที่ต้องการ: 'room', 'cold', 'frozen'
ADD COLUMN IF NOT EXISTS stacking_limit INTEGER DEFAULT 5,    -- จำนวนสูงสุดที่ซ้อนได้
ADD COLUMN IF NOT EXISTS orientation_constraints JSONB,      -- ข้อจำกัดการวาง: {can_rotate: true, must_stand: false}
ADD COLUMN IF NOT EXISTS packaging_type TEXT,                -- ประเภทบรรจุ: 'box', 'pallet', 'loose', 'bag'
ADD COLUMN IF NOT EXISTS uses_pallet BOOLEAN DEFAULT FALSE,  -- ใช้พาเลทหรือไม่
ADD COLUMN IF NOT EXISTS pallet_id UUID REFERENCES public.pallets(id) ON DELETE SET NULL; -- พาเลทที่ใช้ (ถ้า uses_pallet = true)

-- Comments
COMMENT ON COLUMN public.products.length_cm IS 'ความยาวสินค้า (ซม.)';
COMMENT ON COLUMN public.products.width_cm IS 'ความกว้างสินค้า (ซม.)';
COMMENT ON COLUMN public.products.height_cm IS 'ความสูงสินค้า (ซม.)';
COMMENT ON COLUMN public.products.is_fragile IS 'ของแตกง่ายหรือไม่';
COMMENT ON COLUMN public.products.is_liquid IS 'ของเหลวหรือไม่';
COMMENT ON COLUMN public.products.requires_temperature IS 'อุณหภูมิที่ต้องการ: room, cold, frozen';
COMMENT ON COLUMN public.products.stacking_limit IS 'จำนวนสูงสุดที่ซ้อนได้';
COMMENT ON COLUMN public.products.orientation_constraints IS 'ข้อจำกัดการวาง (JSON) - ตัวอย่าง: {"can_rotate": true, "must_stand": false, "allowed_orientations": ["upright", "sideways"]}';
COMMENT ON COLUMN public.products.packaging_type IS 'ประเภทบรรจุ: box, pallet, loose, bag';
COMMENT ON COLUMN public.products.uses_pallet IS 'ใช้พาเลทหรือไม่';
COMMENT ON COLUMN public.products.pallet_id IS 'พาเลทที่ใช้ (ถ้า uses_pallet = true)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_pallet ON public.products(pallet_id);
CREATE INDEX IF NOT EXISTS idx_products_packaging_type ON public.products(packaging_type);
CREATE INDEX IF NOT EXISTS idx_products_uses_pallet ON public.products(uses_pallet);
CREATE INDEX IF NOT EXISTS idx_products_fragile ON public.products(is_fragile);
CREATE INDEX IF NOT EXISTS idx_products_temperature ON public.products(requires_temperature);

-- Constraint: ถ้า uses_pallet = true ต้องมี pallet_id
ALTER TABLE public.products
ADD CONSTRAINT check_pallet_required_if_uses_pallet
CHECK (
  (uses_pallet = FALSE) OR (uses_pallet = TRUE AND pallet_id IS NOT NULL)
);

-- Function: คำนวณ volume_liter อัตโนมัติจากขนาด 3D (ถ้ายังไม่มีค่า)
CREATE OR REPLACE FUNCTION calculate_product_volume_from_dimensions()
RETURNS TRIGGER AS $$
BEGIN
  -- คำนวณปริมาตร (ลิตร) = (length x width x height) / 1000
  -- แต่ถ้ามี volume_liter อยู่แล้วไม่ต้องคำนวณใหม่
  IF NEW.length_cm IS NOT NULL 
     AND NEW.width_cm IS NOT NULL 
     AND NEW.height_cm IS NOT NULL 
     AND (NEW.volume_liter IS NULL OR NEW.volume_liter = 0) THEN
    NEW.volume_liter := (NEW.length_cm * NEW.width_cm * NEW.height_cm) / 1000.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: คำนวณ volume_liter อัตโนมัติ
DROP TRIGGER IF EXISTS trigger_calculate_product_volume_from_dimensions ON public.products;
CREATE TRIGGER trigger_calculate_product_volume_from_dimensions
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION calculate_product_volume_from_dimensions();
