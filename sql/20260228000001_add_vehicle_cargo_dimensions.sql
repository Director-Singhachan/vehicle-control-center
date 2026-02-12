-- ========================================
-- เพิ่มข้อมูลขนาดพื้นที่บรรทุกสำหรับรถ (Vehicles)
-- สำหรับระบบ AI Trip Optimization (3D Bin Packing)
-- ========================================

-- เพิ่มคอลัมน์สำหรับการจัดเรียงสินค้า
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS cargo_length_cm DECIMAL(10, 2),      -- ความยาวพื้นที่บรรทุก (ซม.)
ADD COLUMN IF NOT EXISTS cargo_width_cm DECIMAL(10, 2),       -- ความกว้างพื้นที่บรรทุก (ซม.)
ADD COLUMN IF NOT EXISTS cargo_height_cm DECIMAL(10, 2),     -- ความสูงพื้นที่บรรทุก (ซม.)
ADD COLUMN IF NOT EXISTS max_weight_kg DECIMAL(10, 2),       -- น้ำหนักสูงสุดที่รับได้ (กก.)
ADD COLUMN IF NOT EXISTS cargo_volume_liter DECIMAL(10, 2),  -- ปริมาตรรวม (ลิตร) - คำนวณจาก length x width x height
ADD COLUMN IF NOT EXISTS has_shelves BOOLEAN DEFAULT FALSE,  -- มีชั้นวางหรือไม่
ADD COLUMN IF NOT EXISTS shelf_config JSONB,                 -- รูปแบบชั้นวาง (JSON: [{level: 1, height: 100, ...}])
ADD COLUMN IF NOT EXISTS cargo_shape_type TEXT,             -- รูปแบบ: 'box', 'van', 'truck', 'refrigerated', 'flatbed'
ADD COLUMN IF NOT EXISTS loading_constraints JSONB;          -- ข้อจำกัดการจัดเรียง (JSON: {no_stack_above: [...], fragile_zones: [...]})

-- Comments
COMMENT ON COLUMN public.vehicles.cargo_length_cm IS 'ความยาวพื้นที่บรรทุก (ซม.)';
COMMENT ON COLUMN public.vehicles.cargo_width_cm IS 'ความกว้างพื้นที่บรรทุก (ซม.)';
COMMENT ON COLUMN public.vehicles.cargo_height_cm IS 'ความสูงพื้นที่บรรทุก (ซม.)';
COMMENT ON COLUMN public.vehicles.max_weight_kg IS 'น้ำหนักสูงสุดที่รับได้ (กก.)';
COMMENT ON COLUMN public.vehicles.cargo_volume_liter IS 'ปริมาตรรวม (ลิตร) - คำนวณจาก length x width x height / 1000';
COMMENT ON COLUMN public.vehicles.has_shelves IS 'มีชั้นวางหรือไม่';
COMMENT ON COLUMN public.vehicles.shelf_config IS 'รูปแบบชั้นวาง (JSON) - ตัวอย่าง: {"shelves": [{"level": 1, "height_cm": 120, "max_weight_kg": 500}], "floor": {"height_cm": 150, "max_weight_kg": 1000}}';
COMMENT ON COLUMN public.vehicles.cargo_shape_type IS 'รูปแบบพื้นที่บรรทุก: box, van, truck, refrigerated, flatbed';
COMMENT ON COLUMN public.vehicles.loading_constraints IS 'ข้อจำกัดการจัดเรียง (JSON) - ตัวอย่าง: {"no_stack_above": ["fragile"], "fragile_zones": [{"x": 0, "y": 0, "width": 50, "height": 50}]}';

-- Indexes สำหรับการค้นหา
CREATE INDEX IF NOT EXISTS idx_vehicles_cargo_shape_type ON public.vehicles(cargo_shape_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_has_shelves ON public.vehicles(has_shelves);

-- Function: คำนวณ cargo_volume_liter อัตโนมัติ (ถ้ายังไม่มีค่า)
CREATE OR REPLACE FUNCTION calculate_vehicle_cargo_volume()
RETURNS TRIGGER AS $$
BEGIN
  -- คำนวณปริมาตร (ลิตร) = (length x width x height) / 1000
  IF NEW.cargo_length_cm IS NOT NULL 
     AND NEW.cargo_width_cm IS NOT NULL 
     AND NEW.cargo_height_cm IS NOT NULL 
     AND (NEW.cargo_volume_liter IS NULL OR NEW.cargo_volume_liter = 0) THEN
    NEW.cargo_volume_liter := (NEW.cargo_length_cm * NEW.cargo_width_cm * NEW.cargo_height_cm) / 1000.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: คำนวณ cargo_volume_liter อัตโนมัติ
DROP TRIGGER IF EXISTS trigger_calculate_vehicle_cargo_volume ON public.vehicles;
CREATE TRIGGER trigger_calculate_vehicle_cargo_volume
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vehicle_cargo_volume();
