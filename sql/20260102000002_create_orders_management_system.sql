-- ========================================
-- Orders Management System
-- ระบบจัดการ Orders จากลูกค้า
-- ========================================

-- ========================================
-- 1. ตาราง orders (คำสั่งซื้อ)
-- ========================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE, -- เลขที่ออเดอร์ เช่น ORD-2025-0001
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE, -- วันที่ต้องการให้จัดส่ง
  
  -- สถานะออเดอร์
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- รออนุมัติ
    'confirmed',      -- ยืนยันแล้ว รอจัดทริป
    'assigned',       -- จัดทริปแล้ว
    'in_delivery',    -- กำลังจัดส่ง
    'delivered',      -- ส่งแล้ว
    'cancelled'       -- ยกเลิก
  )),
  
  -- ข้อมูลราคา
  subtotal DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- ข้อมูลการจัดส่ง
  delivery_trip_id UUID REFERENCES public.delivery_trips(id) ON DELETE SET NULL,
  delivery_address TEXT, -- ที่อยู่จัดส่ง (ถ้าต่างจากที่อยู่ร้าน)
  
  -- หมายเหตุ
  notes TEXT,
  internal_notes TEXT, -- หมายเหตุภายใน (ลูกค้าไม่เห็น)
  
  -- ข้อมูลผู้สร้าง
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- 2. ตาราง order_items (สินค้าในออเดอร์)
-- ========================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL, -- ราคาต่อหน่วยตอนสั่ง (เก็บไว้เผื่อราคาเปลี่ยน)
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  line_total DECIMAL(10, 2) NOT NULL, -- ยอดรวมแต่ละรายการ
  
  notes TEXT, -- หมายเหตุเฉพาะรายการ
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- 3. ตาราง order_status_history (ประวัติการเปลี่ยนสถานะ)
-- ========================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_trip_id ON public.orders(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

-- ========================================
-- Function: สร้างเลขที่ออเดอร์อัตโนมัติ
-- ========================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  max_number INT;
  current_year_month TEXT;
BEGIN
  -- รูปแบบ: ORD-YYMM-XXXX (เช่น ORD-2501-0001)
  current_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  
  -- หาเลขล่าสุดในเดือนนี้
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(
          order_number, 
          'ORD-' || current_year_month || '-', 
          ''
        ), 
        ''
      )::INT
    ), 
    0
  ) INTO max_number
  FROM public.orders
  WHERE order_number LIKE 'ORD-' || current_year_month || '-%';
  
  -- สร้างเลขใหม่
  new_number := 'ORD-' || current_year_month || '-' || LPAD((max_number + 1)::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Trigger: สร้างเลขที่ออเดอร์อัตโนมัติ
-- ========================================
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- ========================================
-- Trigger: อัปเดต updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

CREATE TRIGGER trigger_update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- ========================================
-- Trigger: บันทึกประวัติการเปลี่ยนสถานะ
-- ========================================
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (
      order_id,
      from_status,
      to_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- ========================================
-- Function: คำนวณยอดรวมออเดอร์
-- ========================================
CREATE OR REPLACE FUNCTION calculate_order_total(p_order_id UUID)
RETURNS void AS $$
DECLARE
  v_subtotal DECIMAL(10, 2);
BEGIN
  -- คำนวณ subtotal จาก order_items
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_subtotal
  FROM public.order_items
  WHERE order_id = p_order_id;
  
  -- อัปเดตยอดรวมในออเดอร์
  UPDATE public.orders
  SET 
    subtotal = v_subtotal,
    total_amount = v_subtotal - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0)
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Trigger: คำนวณยอดรวมเมื่อมีการเปลี่ยนแปลง order_items
-- ========================================
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้าเป็น INSERT หรือ UPDATE ใช้ order_id ใหม่
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_order_total(NEW.order_id);
  END IF;
  
  -- ถ้าเป็น DELETE ใช้ order_id เก่า
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_order_total(OLD.order_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_order_total
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_total();

-- ========================================
-- View: orders_with_details
-- ========================================
CREATE OR REPLACE VIEW public.orders_with_details AS
SELECT 
  o.*,
  s.customer_code,
  s.customer_name,
  s.address as store_address,
  s.phone as store_phone,
  ct.tier_code,
  ct.tier_name,
  ct.color as tier_color,
  dt.trip_number,
  dt.status as trip_status,
  dt.planned_date as trip_date,
  creator.full_name as created_by_name,
  confirmer.full_name as confirmed_by_name,
  -- นับจำนวนรายการสินค้า
  (SELECT COUNT(*) FROM public.order_items WHERE order_id = o.id) as items_count,
  -- นับจำนวนสินค้าทั้งหมด
  (SELECT COALESCE(SUM(quantity), 0) FROM public.order_items WHERE order_id = o.id) as total_quantity
FROM public.orders o
LEFT JOIN public.stores s ON o.store_id = s.id
LEFT JOIN public.customer_tiers ct ON s.tier_id = ct.id
LEFT JOIN public.delivery_trips dt ON o.delivery_trip_id = dt.id
LEFT JOIN public.profiles creator ON o.created_by = creator.id
LEFT JOIN public.profiles confirmer ON o.confirmed_by = confirmer.id;

-- Grant access
GRANT SELECT ON public.orders_with_details TO authenticated;

-- ========================================
-- View: pending_orders (ออเดอร์ที่รอจัดทริป)
-- ========================================
CREATE OR REPLACE VIEW public.pending_orders AS
SELECT *
FROM public.orders_with_details
WHERE status IN ('confirmed')
  AND delivery_trip_id IS NULL
ORDER BY order_date, created_at;

-- Grant access
GRANT SELECT ON public.pending_orders TO authenticated;

-- ========================================
-- RLS Policies
-- ========================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Orders: ทุกคนอ่านได้
CREATE POLICY "Anyone can view orders" 
  ON public.orders FOR SELECT TO authenticated USING (true);

-- Orders: Staff+ สร้างได้
CREATE POLICY "Staff can create orders" 
  ON public.orders FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'user'))
  );

-- Orders: เจ้าของ + Admin แก้ไขได้
CREATE POLICY "Owner and admin can update orders" 
  ON public.orders FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

-- Order Items: ทุกคนอ่านได้
CREATE POLICY "Anyone can view order items" 
  ON public.order_items FOR SELECT TO authenticated USING (true);

-- Order Items: Staff+ จัดการได้
CREATE POLICY "Staff can manage order items" 
  ON public.order_items FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'user'))
  );

-- Order Status History: ทุกคนอ่านได้
CREATE POLICY "Anyone can view order status history" 
  ON public.order_status_history FOR SELECT TO authenticated USING (true);

-- ========================================
-- Comments
-- ========================================
COMMENT ON TABLE public.orders IS 'คำสั่งซื้อจากลูกค้า';
COMMENT ON TABLE public.order_items IS 'รายการสินค้าในออเดอร์';
COMMENT ON TABLE public.order_status_history IS 'ประวัติการเปลี่ยนสถานะออเดอร์';
COMMENT ON FUNCTION generate_order_number IS 'สร้างเลขที่ออเดอร์อัตโนมัติ รูปแบบ ORD-YYMM-XXXX';
COMMENT ON FUNCTION calculate_order_total IS 'คำนวณยอดรวมออเดอร์จาก order_items';

