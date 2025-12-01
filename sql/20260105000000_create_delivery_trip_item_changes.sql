-- Migration: Create delivery_trip_item_changes for audit logging of item edits

CREATE TABLE IF NOT EXISTS public.delivery_trip_item_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  delivery_trip_store_id UUID REFERENCES public.delivery_trip_stores(id) ON DELETE SET NULL,
  delivery_trip_item_id UUID REFERENCES public.delivery_trip_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('add', 'update', 'remove')),
  old_quantity DECIMAL(10, 2),
  new_quantity DECIMAL(10, 2),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_trip_item_changes_trip_id
  ON public.delivery_trip_item_changes(delivery_trip_id);

CREATE INDEX IF NOT EXISTS idx_delivery_trip_item_changes_store_id
  ON public.delivery_trip_item_changes(delivery_trip_store_id);

CREATE INDEX IF NOT EXISTS idx_delivery_trip_item_changes_item_id
  ON public.delivery_trip_item_changes(delivery_trip_item_id);

ALTER TABLE public.delivery_trip_item_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY delivery_trip_item_changes_select ON public.delivery_trip_item_changes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY delivery_trip_item_changes_insert ON public.delivery_trip_item_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

COMMENT ON TABLE public.delivery_trip_item_changes IS 'ประวัติการแก้ไขรายการสินค้าในทริปส่งสินค้า';


