-- ========================================
-- ระบบกำหนดราคาสินค้าตามระดับลูกค้า
-- Customer Tier Pricing System
-- ========================================

-- ========================================
-- 1. เพิ่มคอลัมน์ราคาและทุนในตาราง products ที่มีอยู่แล้ว
-- ========================================
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10, 3),
ADD COLUMN IF NOT EXISTS volume_liter DECIMAL(10, 3);

-- เพิ่ม index สำหรับการค้นหา barcode
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- ========================================
-- 2. สร้างตาราง customer_tiers (ระดับลูกค้า)
-- ========================================
CREATE TABLE IF NOT EXISTS public.customer_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_code VARCHAR(20) UNIQUE NOT NULL, -- เช่น A, B, C, D หรือ GOLD, SILVER, BRONZE
  tier_name VARCHAR(100) NOT NULL, -- ชื่อระดับ เช่น "ลูกค้า A", "ทอง"
  description TEXT,
  discount_percent DECIMAL(5, 2) DEFAULT 0, -- ส่วนลดเริ่มต้น (%)
  min_order_amount DECIMAL(10, 2) DEFAULT 0, -- ยอดสั่งซื้อขั้นต่ำ
  color VARCHAR(7) DEFAULT '#3B82F6', -- สีสำหรับแสดงใน UI
  display_order INTEGER DEFAULT 0, -- ลำดับการแสดงผล
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3. เพิ่มคอลัมน์ tier_id ในตาราง stores (ลูกค้า)
-- ========================================
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.customer_tiers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms INTEGER DEFAULT 0; -- จำนวนวันเครดิต

-- เพิ่ม index
CREATE INDEX IF NOT EXISTS idx_stores_tier_id ON public.stores(tier_id);

-- ========================================
-- 4. สร้างตาราง product_tier_prices (ราคาสินค้าตามระดับลูกค้า)
-- ========================================
CREATE TABLE IF NOT EXISTS public.product_tier_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.customer_tiers(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL, -- ราคาสำหรับระดับนี้
  min_quantity INTEGER DEFAULT 1, -- จำนวนขั้นต่ำ (สำหรับราคาขั้นบันได)
  effective_from DATE, -- วันที่เริ่มใช้ราคานี้
  effective_to DATE, -- วันที่สิ้นสุด (NULL = ไม่มีวันหมดอายุ)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  UNIQUE(product_id, tier_id, min_quantity) -- แต่ละสินค้า + tier + quantity ต้องไม่ซ้ำ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_tier_prices_product ON public.product_tier_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tier_prices_tier ON public.product_tier_prices(tier_id);
CREATE INDEX IF NOT EXISTS idx_product_tier_prices_active ON public.product_tier_prices(is_active);

-- ========================================
-- 5. สร้างตาราง price_change_history (ประวัติการเปลี่ยนราคา)
-- ========================================
CREATE TABLE IF NOT EXISTS public.price_change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.customer_tiers(id) ON DELETE SET NULL,
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,
  change_reason TEXT,
  effective_date DATE NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.price_change_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON public.price_change_history(effective_date);

-- ========================================
-- 6. สร้างตาราง warehouses (คลังสินค้า - ไม่ขัดแย้ง)
-- ========================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) DEFAULT 'branch', -- main, branch, mobile
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  capacity_m3 DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 7. สร้างตาราง inventory (สต็อกสินค้า)
-- ========================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  min_stock_level INTEGER DEFAULT 0, -- ระดับสต็อกต่ำสุด
  max_stock_level INTEGER, -- ระดับสต็อกสูงสุด
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(warehouse_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON public.inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);

-- ========================================
-- 8. สร้าง Functions และ Triggers
-- ========================================

-- Function: อัพเดท updated_at
CREATE OR REPLACE FUNCTION update_tier_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_customer_tiers_updated_at 
  BEFORE UPDATE ON public.customer_tiers
  FOR EACH ROW EXECUTE FUNCTION update_tier_pricing_updated_at();

CREATE TRIGGER update_product_tier_prices_updated_at 
  BEFORE UPDATE ON public.product_tier_prices
  FOR EACH ROW EXECUTE FUNCTION update_tier_pricing_updated_at();

CREATE TRIGGER update_warehouses_updated_at 
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION update_tier_pricing_updated_at();

CREATE TRIGGER update_inventory_updated_at 
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION update_tier_pricing_updated_at();

-- ========================================
-- 9. Function: คำนวณราคาสำหรับลูกค้า
-- ========================================
CREATE OR REPLACE FUNCTION get_product_price_for_store(
  p_product_id UUID,
  p_store_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  v_tier_id UUID;
  v_price DECIMAL(10, 2);
  v_base_price DECIMAL(10, 2);
BEGIN
  -- ดึง tier_id ของร้าน
  SELECT tier_id INTO v_tier_id
  FROM public.stores
  WHERE id = p_store_id;
  
  -- ถ้ามี tier กำหนดไว้ ให้หาราคาตาม tier
  IF v_tier_id IS NOT NULL THEN
    SELECT price INTO v_price
    FROM public.product_tier_prices
    WHERE product_id = p_product_id
      AND tier_id = v_tier_id
      AND min_quantity <= p_quantity
      AND is_active = true
      AND (effective_from IS NULL OR effective_from <= p_date)
      AND (effective_to IS NULL OR effective_to >= p_date)
    ORDER BY min_quantity DESC
    LIMIT 1;
  END IF;
  
  -- ถ้าไม่มีราคา tier ให้ใช้ base_price
  IF v_price IS NULL THEN
    SELECT base_price INTO v_price
    FROM public.products
    WHERE id = p_product_id;
  END IF;
  
  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 10. View: แสดงราคาสินค้าทั้งหมด
-- ========================================
CREATE OR REPLACE VIEW public.product_prices_summary AS
SELECT 
  p.id as product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit,
  p.base_price,
  p.cost_per_unit,
  ct.tier_code,
  ct.tier_name,
  ptp.price as tier_price,
  ptp.min_quantity,
  ptp.effective_from,
  ptp.effective_to,
  ptp.is_active as price_active,
  ROUND((ptp.price - p.cost_per_unit) / NULLIF(ptp.price, 0) * 100, 2) as margin_percent
FROM public.products p
LEFT JOIN public.product_tier_prices ptp ON p.id = ptp.product_id
LEFT JOIN public.customer_tiers ct ON ptp.tier_id = ct.id
WHERE p.is_active = true
ORDER BY p.product_code, ct.display_order;

-- Grant access
GRANT SELECT ON public.product_prices_summary TO authenticated;

-- ========================================
-- 11. View: สต็อกสินค้าพร้อมรายละเอียด
-- ========================================
CREATE OR REPLACE VIEW public.inventory_with_details AS
SELECT 
  i.id,
  i.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  w.type as warehouse_type,
  i.product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit,
  p.base_price,
  i.quantity,
  i.reserved_quantity,
  i.available_quantity,
  i.min_stock_level,
  i.max_stock_level,
  CASE 
    WHEN i.available_quantity <= 0 THEN 'out_of_stock'
    WHEN i.available_quantity <= i.min_stock_level THEN 'low_stock'
    WHEN i.max_stock_level IS NOT NULL AND i.quantity >= i.max_stock_level THEN 'overstock'
    ELSE 'in_stock'
  END as stock_status,
  i.last_updated_at,
  i.created_at
FROM public.inventory i
LEFT JOIN public.warehouses w ON i.warehouse_id = w.id
LEFT JOIN public.products p ON i.product_id = p.id
WHERE p.is_active = true;

-- Grant access
GRANT SELECT ON public.inventory_with_details TO authenticated;

-- ========================================
-- 12. Row Level Security (RLS)
-- ========================================

-- Enable RLS
ALTER TABLE public.customer_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Policies: ทุกคนอ่านได้, แต่ admin/manager แก้ไขได้
CREATE POLICY "Anyone can view customer tiers" 
  ON public.customer_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage customer tiers" 
  ON public.customer_tiers FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

CREATE POLICY "Anyone can view product tier prices" 
  ON public.product_tier_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage product tier prices" 
  ON public.product_tier_prices FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

CREATE POLICY "Anyone can view price history" 
  ON public.price_change_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage warehouses" 
  ON public.warehouses FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

CREATE POLICY "Anyone can view inventory" 
  ON public.inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage inventory" 
  ON public.inventory FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'user'))
  );

-- ========================================
-- 13. ข้อมูลตัวอย่างเริ่มต้น
-- ========================================

-- ระดับลูกค้า
INSERT INTO public.customer_tiers (tier_code, tier_name, description, discount_percent, color, display_order) VALUES
('A', 'ลูกค้า A (VIP)', 'ลูกค้าประจำ ปริมาณสูง', 10.00, '#FFD700', 1),
('B', 'ลูกค้า B', 'ลูกค้าประจำ ปริมาณปานกลาง', 5.00, '#C0C0C0', 2),
('C', 'ลูกค้า C', 'ลูกค้าทั่วไป', 0.00, '#CD7F32', 3),
('D', 'ลูกค้า D (ใหม่)', 'ลูกค้าใหม่', 0.00, '#808080', 4)
ON CONFLICT (tier_code) DO NOTHING;

-- คลังสินค้า
INSERT INTO public.warehouses (code, name, type, address) VALUES
('WH-MAIN', 'คลังสินค้าหลัก', 'main', 'กรุงเทพฯ'),
('WH-BR01', 'คลังสาขา 1', 'branch', 'นนทบุรี'),
('WH-BR02', 'คลังสาขา 2', 'branch', 'ปทุมธานี')
ON CONFLICT (code) DO NOTHING;

-- Comments
COMMENT ON TABLE public.customer_tiers IS 'ระดับลูกค้า (A, B, C, D)';
COMMENT ON TABLE public.product_tier_prices IS 'ราคาสินค้าตามระดับลูกค้า';
COMMENT ON TABLE public.price_change_history IS 'ประวัติการเปลี่ยนแปลงราคา';
COMMENT ON TABLE public.warehouses IS 'คลังสินค้า';
COMMENT ON TABLE public.inventory IS 'สต็อกสินค้าในแต่ละคลัง';
COMMENT ON FUNCTION get_product_price_for_store IS 'คำนวณราคาสินค้าสำหรับร้านค้าตาม tier และ quantity';

