-- ========================================
-- Create Delivery Trip Management Tables
-- ========================================
-- This migration creates tables for managing delivery trips with stores and products

-- 1. Stores/Customers Table
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL, -- เช่น ชิ้น, กล่อง, ลัง, กิโลกรัม
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- 3. Delivery Trips Table
CREATE TABLE IF NOT EXISTS public.delivery_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number TEXT UNIQUE, -- รหัสทริป เช่น DT-2025-001
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES public.profiles(id),
  planned_date DATE NOT NULL,
  odometer_start INTEGER,
  odometer_end INTEGER,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- 4. Delivery Trip Stores (Many-to-Many: Trip -> Stores)
CREATE TABLE IF NOT EXISTS public.delivery_trip_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  sequence_order INTEGER NOT NULL DEFAULT 0, -- ลำดับการส่ง (1, 2, 3, ...)
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(delivery_trip_id, store_id) -- Prevent duplicate stores in same trip
);

-- 5. Delivery Trip Items (Products for each store in trip)
CREATE TABLE IF NOT EXISTS public.delivery_trip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  delivery_trip_store_id UUID NOT NULL REFERENCES public.delivery_trip_stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_customer_code ON public.stores(customer_code);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON public.stores(is_active);
CREATE INDEX IF NOT EXISTS idx_products_product_code ON public.products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_trip_number ON public.delivery_trips(trip_number);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_vehicle_id ON public.delivery_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_status ON public.delivery_trips(status);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_planned_date ON public.delivery_trips(planned_date);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_stores_trip_id ON public.delivery_trip_stores(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_stores_store_id ON public.delivery_trip_stores(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_items_trip_id ON public.delivery_trip_items(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_items_store_id ON public.delivery_trip_items(delivery_trip_store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_items_product_id ON public.delivery_trip_items(product_id);

-- Trigger for trip_number auto-generation
CREATE OR REPLACE FUNCTION generate_delivery_trip_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
BEGIN
  -- Generate format: DT-YYYY-XXX (e.g., DT-2025-001)
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  
  -- Get last trip number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.delivery_trips
  WHERE trip_number LIKE 'DT-' || year_prefix || '-%';
  
  -- Generate new number
  new_number := 'DT-' || year_prefix || '-' || LPAD((last_number + 1)::TEXT, 3, '0');
  
  NEW.trip_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_delivery_trip_number
  BEFORE INSERT ON public.delivery_trips
  FOR EACH ROW
  WHEN (NEW.trip_number IS NULL)
  EXECUTE FUNCTION generate_delivery_trip_number();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_delivery_trip_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivery_trips_updated_at
  BEFORE UPDATE ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_trip_updated_at();

CREATE TRIGGER trigger_update_delivery_trip_items_updated_at
  BEFORE UPDATE ON public.delivery_trip_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_trip_updated_at();

-- RLS Policies
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trip_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trip_items ENABLE ROW LEVEL SECURITY;

-- Stores RLS: All authenticated users can read, only admins/managers can modify
CREATE POLICY stores_select ON public.stores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY stores_insert ON public.stores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY stores_update ON public.stores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY stores_delete ON public.stores
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Products RLS: All authenticated users can read, only admins/managers can modify
CREATE POLICY products_select ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY products_insert ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY products_update ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY products_delete ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Delivery Trips RLS: All authenticated users can read, admins/managers can create, drivers can update their own trips
CREATE POLICY delivery_trips_select ON public.delivery_trips
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY delivery_trips_insert ON public.delivery_trips
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY delivery_trips_update ON public.delivery_trips
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
    OR driver_id = auth.uid() -- Drivers can update their own trips
  );

CREATE POLICY delivery_trips_delete ON public.delivery_trips
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Delivery Trip Stores RLS: Same as delivery_trips
CREATE POLICY delivery_trip_stores_select ON public.delivery_trip_stores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY delivery_trip_stores_insert ON public.delivery_trip_stores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY delivery_trip_stores_update ON public.delivery_trip_stores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY delivery_trip_stores_delete ON public.delivery_trip_stores
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

-- Delivery Trip Items RLS: Same as delivery_trips
CREATE POLICY delivery_trip_items_select ON public.delivery_trip_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY delivery_trip_items_insert ON public.delivery_trip_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY delivery_trip_items_update ON public.delivery_trip_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY delivery_trip_items_delete ON public.delivery_trip_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

-- Comments
COMMENT ON TABLE public.stores IS 'ข้อมูลร้านค้า/ลูกค้า';
COMMENT ON TABLE public.products IS 'ข้อมูลสินค้า';
COMMENT ON TABLE public.delivery_trips IS 'ทริปส่งสินค้า';
COMMENT ON TABLE public.delivery_trip_stores IS 'ร้านค้าในแต่ละทริป';
COMMENT ON TABLE public.delivery_trip_items IS 'รายการสินค้าสำหรับแต่ละร้านในทริป';

