-- ========================================
-- Inventory schema fixes: add reserved/available and transaction log
-- ========================================

-- 1) Add reserved_quantity and available_quantity to inventory
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS reserved_quantity NUMERIC DEFAULT 0;

-- If available_quantity is not present, add as generated column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory'
      AND column_name = 'available_quantity'
  ) THEN
    ALTER TABLE public.inventory
    ADD COLUMN available_quantity NUMERIC GENERATED ALWAYS AS (quantity - reserved_quantity) STORED;
  END IF;
END $$;

-- Backfill reserved_quantity to 0 where NULL
UPDATE public.inventory
SET reserved_quantity = 0
WHERE reserved_quantity IS NULL;

-- 2) Recreate inventory_with_details view to include available_quantity
DROP VIEW IF EXISTS public.inventory_with_details;

CREATE VIEW public.inventory_with_details AS
SELECT
  i.id,
  i.warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  w.type AS warehouse_type,
  i.product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit,
  p.base_price,
  i.quantity,
  i.reserved_quantity,
  i.available_quantity,
  i.last_updated_at,
  i.created_at,
  CASE
    WHEN i.available_quantity <= 0 THEN 'out_of_stock'
    WHEN i.available_quantity <= COALESCE(i.min_stock_level, 0) THEN 'low_stock'
    WHEN i.max_stock_level IS NOT NULL AND i.quantity >= i.max_stock_level THEN 'overstock'
    ELSE 'in_stock'
  END AS stock_status
FROM public.inventory i
LEFT JOIN public.warehouses w ON i.warehouse_id = w.id
LEFT JOIN public.products p ON i.product_id = p.id
WHERE p.is_active = TRUE;

GRANT SELECT ON public.inventory_with_details TO authenticated;

-- 3) Create inventory_transactions table (for stock movements)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in','out','adjust','reserve','release')),
  quantity NUMERIC NOT NULL,
  note TEXT,
  ref_code TEXT,             -- ใบกำกับ/เลขอ้างอิง
  reference_type TEXT,       -- ประเภทอ้างอิง เช่น order, trip
  reference_id UUID,         -- ไอดีอ้างอิง
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_warehouse ON public.inventory_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_product ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_created_at ON public.inventory_transactions(created_at);

GRANT SELECT, INSERT ON public.inventory_transactions TO authenticated;


