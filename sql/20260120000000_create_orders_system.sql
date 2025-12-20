-- ========================================
-- Create Orders System for Mobile App
-- ========================================
-- This migration creates tables for customer orders that will be used by the mobile app
-- Orders can be converted to delivery trips in the web app

-- 1. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE, -- รหัสออเดอร์ เช่น ORD-2025-001
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.profiles(id), -- ผู้สั่ง (ถ้าเป็น user)
  sales_person_id UUID REFERENCES public.profiles(id), -- พนักงานขาย
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE, -- วันที่ต้องการรับสินค้า
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',              -- รอขายส่งให้คลัง
    'sent_to_warehouse',    -- ขายส่งให้คลังแล้ว
    'queue_ready',          -- คลังจัดคิวเสร็จแล้ว (พร้อมให้ขายออกบิล)
    'billed',               -- ขายออกบิลแล้ว
    'preparing',            -- กำลังเตรียมสินค้า
    'ready',                -- พร้อมส่ง
    'assigned',             -- มอบหมายให้ทริปแล้ว
    'in_transit',           -- กำลังส่ง
    'delivered',            -- ส่งแล้ว
    'cancelled',            -- ยกเลิก
    'rejected'              -- ปฏิเสธ
  )),
  total_amount DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  delivery_trip_id UUID REFERENCES public.delivery_trips(id) -- เชื่อมกับทริป
);

-- 2. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_price DECIMAL(10, 2), -- ราคาต่อหน่วย (เก็บไว้สำหรับออเดอร์)
  subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_price, 0)) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Order Status History (สำหรับ tracking)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales_person_id ON public.orders(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_trip_id ON public.orders(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

-- Trigger for order_number auto-generation
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  current_year INTEGER;
  current_month INTEGER;
  lock_key BIGINT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  current_month := EXTRACT(MONTH FROM NOW())::INTEGER;
  
  -- Generate format: ORD-YYMM-XXXX (e.g., ORD-2501-0001)
  year_month_prefix := 'ORD-' || 
    LPAD((current_year % 100)::TEXT, 2, '0') || 
    LPAD(current_month::TEXT, 2, '0') || 
    '-';
  
  lock_key := (current_year * 100 + current_month)::BIGINT;
  
  PERFORM pg_advisory_xact_lock(lock_key);
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.orders
  WHERE order_number LIKE year_month_prefix || '%'
    AND order_number ~ (year_month_prefix || '[0-9]+$');
  
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  NEW.order_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

-- Trigger for updated_at
CREATE TRIGGER trigger_update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_trip_updated_at();

CREATE TRIGGER trigger_update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_trip_updated_at();

-- Trigger to update order total_amount when items change
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.orders
  SET total_amount = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM public.order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_total_on_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

CREATE TRIGGER trigger_update_order_total_on_update
  AFTER UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

CREATE TRIGGER trigger_update_order_total_on_delete
  AFTER DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, status, changed_by, notes)
    VALUES (NEW.id, NEW.status, auth.uid(), 
      'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- RLS Policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Orders RLS: Customers see their own, Sales see all, Managers/Admins full access
CREATE POLICY orders_select ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    -- Customers can see their own orders
    customer_id = auth.uid()
    OR store_id IN (
      SELECT id FROM public.stores WHERE created_by = auth.uid()
    )
    -- Sales can see all orders
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('sales', 'manager', 'admin', 'inspector')
    )
  );

CREATE POLICY orders_insert ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Customers can create orders for their store
    customer_id = auth.uid()
    OR store_id IN (
      SELECT id FROM public.stores WHERE created_by = auth.uid()
    )
    -- Sales can create orders
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('sales', 'manager', 'admin')
    )
  );

CREATE POLICY orders_update ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    -- Customers can update their own pending orders
    (customer_id = auth.uid() AND status = 'pending')
    -- Sales/Managers/Admins can update all orders
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('sales', 'manager', 'admin', 'inspector')
    )
  );

CREATE POLICY orders_delete ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    -- Only Managers/Admins can delete
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

-- Order Items RLS: Same as orders
CREATE POLICY order_items_select ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id
      AND (
        customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('sales', 'manager', 'admin', 'inspector')
        )
      )
    )
  );

CREATE POLICY order_items_insert ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id
      AND (
        customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('sales', 'manager', 'admin')
        )
      )
    )
  );

CREATE POLICY order_items_update ON public.order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id
      AND (
        (customer_id = auth.uid() AND status = 'pending')
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('sales', 'manager', 'admin', 'inspector')
        )
      )
    )
  );

CREATE POLICY order_items_delete ON public.order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id
      AND (
        (customer_id = auth.uid() AND status = 'pending')
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('manager', 'admin')
        )
      )
    )
  );

-- Order Status History RLS: Same visibility as orders
CREATE POLICY order_status_history_select ON public.order_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_status_history.order_id
      AND (
        customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('sales', 'manager', 'admin', 'inspector')
        )
      )
    )
  );

-- Comments
COMMENT ON TABLE public.orders IS 'ออเดอร์ที่ลูกค้าสั่งสินค้า';
COMMENT ON TABLE public.order_items IS 'รายการสินค้าในออเดอร์';
COMMENT ON TABLE public.order_status_history IS 'ประวัติการเปลี่ยนสถานะออเดอร์';

