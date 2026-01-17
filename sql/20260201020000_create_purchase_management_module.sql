-- ========================================================
-- Purchase Management Module (การจัดซื้อ)
-- Migration: 20260201020000
-- ========================================================

-- ========================================================
-- 1. SUPPLIERS (ผู้ขาย/ซัพพลายเออร์)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  payment_terms TEXT, -- เช่น "Net 30", "COD"
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers(is_active);

-- ========================================================
-- 2. PURCHASE ORDERS (ใบสั่งซื้อ)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'received', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON public.purchase_orders(order_date);

-- ========================================================
-- 3. PURCHASE ORDER ITEMS (รายการในใบสั่งซื้อ)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  received_quantity DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON public.purchase_order_items(product_id);

-- ========================================================
-- 4. GOODS RECEIPT (ใบรับสินค้า)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT UNIQUE NOT NULL,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_number ON public.goods_receipts(receipt_no);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON public.goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_warehouse ON public.goods_receipts(warehouse_id);

-- ========================================================
-- 5. GOODS RECEIPT ITEMS (รายการในใบรับสินค้า)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id),
  quantity_received DECIMAL(10, 2) NOT NULL,
  quality_status TEXT DEFAULT 'good' CHECK (quality_status IN ('good', 'damaged', 'defective')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_receipt ON public.goods_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_po_item ON public.goods_receipt_items(po_item_id);

-- ========================================================
-- 6. SUPPLIER INVOICES (ใบแจ้งหนี้จากผู้ขาย - Accounts Payable)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  po_id UUID REFERENCES public.purchase_orders(id),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  paid_amount DECIMAL(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_number ON public.supplier_invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON public.supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON public.supplier_invoices(status);

-- ========================================================
-- 7. SUPPLIER PAYMENTS (การชำระเงินให้ผู้ขาย)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15, 2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'credit_card', 'other')),
  reference_no TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON public.supplier_payments(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON public.supplier_payments(payment_date);

-- ========================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ========================================================

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- Suppliers: All authenticated users can read, only managers/admins can modify
CREATE POLICY suppliers_select ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Purchase Orders: Managers/Admins can manage
CREATE POLICY purchase_orders_select ON public.purchase_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY purchase_orders_insert ON public.purchase_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY purchase_orders_update ON public.purchase_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Purchase Order Items: Same as purchase orders
CREATE POLICY purchase_order_items_select ON public.purchase_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.po_id
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector')
      )
    )
  );

CREATE POLICY purchase_order_items_insert ON public.purchase_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.po_id
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
      )
    )
  );

-- Goods Receipts: Warehouse staff and managers can manage
CREATE POLICY goods_receipts_select ON public.goods_receipts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY goods_receipts_insert ON public.goods_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Supplier Invoices: Managers/Admins can manage
CREATE POLICY supplier_invoices_select ON public.supplier_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY supplier_invoices_insert ON public.supplier_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Supplier Payments: Managers/Admins only
CREATE POLICY supplier_payments_select ON public.supplier_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY supplier_payments_insert ON public.supplier_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- ========================================================

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_orders_updated_at();

CREATE OR REPLACE FUNCTION update_goods_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_goods_receipts_updated_at
  BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_goods_receipts_updated_at();

CREATE OR REPLACE FUNCTION update_supplier_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_invoices_updated_at
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_invoices_updated_at();

-- ========================================================
-- 10. TRIGGERS FOR AUTO-GENERATION
-- ========================================================

-- Generate PO Number
CREATE OR REPLACE FUNCTION generate_po_number()
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
  
  year_month_prefix := 'PO-' || 
    LPAD((current_year % 100)::TEXT, 2, '0') || 
    LPAD(current_month::TEXT, 2, '0') || 
    '-';
  
  lock_key := (current_year * 100 + current_month)::BIGINT;
  
  PERFORM pg_advisory_xact_lock(lock_key);
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.purchase_orders
  WHERE po_number LIKE year_month_prefix || '%'
    AND po_number ~ (year_month_prefix || '[0-9]+$');
  
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  NEW.po_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_po_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION generate_po_number();

-- Generate Receipt Number
CREATE OR REPLACE FUNCTION generate_receipt_number()
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
  
  year_month_prefix := 'GR-' || 
    LPAD((current_year % 100)::TEXT, 2, '0') || 
    LPAD(current_month::TEXT, 2, '0') || 
    '-';
  
  lock_key := (current_year * 100 + current_month)::BIGINT;
  
  PERFORM pg_advisory_xact_lock(lock_key);
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_no FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.goods_receipts
  WHERE receipt_no LIKE year_month_prefix || '%'
    AND receipt_no ~ (year_month_prefix || '[0-9]+$');
  
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  NEW.receipt_no := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_receipt_number
  BEFORE INSERT ON public.goods_receipts
  FOR EACH ROW
  WHEN (NEW.receipt_no IS NULL)
  EXECUTE FUNCTION generate_receipt_number();

-- ========================================================
-- 11. VIEWS FOR REPORTING
-- ========================================================

-- Accounts Payable Summary (สรุปเจ้าหนี้)
CREATE OR REPLACE VIEW public.accounts_payable_summary AS
SELECT
  s.id,
  s.name,
  COUNT(si.id) as invoice_count,
  SUM(si.total_amount) as total_invoiced,
  SUM(si.paid_amount) as total_paid,
  SUM(si.total_amount - si.paid_amount) as outstanding_amount,
  MAX(si.invoice_date) as last_invoice_date
FROM public.suppliers s
LEFT JOIN public.supplier_invoices si ON s.id = si.supplier_id
WHERE si.status != 'cancelled'
GROUP BY s.id, s.name;

-- Purchase Order Status Report
CREATE OR REPLACE VIEW public.purchase_order_status_report AS
SELECT
  po.po_number,
  s.name as supplier_name,
  po.order_date,
  po.expected_delivery,
  po.total_amount,
  po.status,
  COUNT(poi.id) as item_count,
  SUM(CASE WHEN poi.received_quantity > 0 THEN 1 ELSE 0 END) as received_items
FROM public.purchase_orders po
LEFT JOIN public.suppliers s ON po.supplier_id = s.id
LEFT JOIN public.purchase_order_items poi ON po.id = poi.po_id
GROUP BY po.id, po.po_number, s.name, po.order_date, po.expected_delivery, po.total_amount, po.status;

GRANT SELECT ON public.accounts_payable_summary TO authenticated;
GRANT SELECT ON public.purchase_order_status_report TO authenticated;

-- ========================================================
-- 12. COMMENTS
-- ========================================================

COMMENT ON TABLE public.suppliers IS 'ข้อมูลผู้ขาย/ซัพพลายเออร์';
COMMENT ON TABLE public.purchase_orders IS 'ใบสั่งซื้อ';
COMMENT ON TABLE public.purchase_order_items IS 'รายการในใบสั่งซื้อ';
COMMENT ON TABLE public.goods_receipts IS 'ใบรับสินค้า';
COMMENT ON TABLE public.goods_receipt_items IS 'รายการในใบรับสินค้า';
COMMENT ON TABLE public.supplier_invoices IS 'ใบแจ้งหนี้จากผู้ขาย (Accounts Payable)';
COMMENT ON TABLE public.supplier_payments IS 'บันทึกการชำระเงินให้ผู้ขาย';
