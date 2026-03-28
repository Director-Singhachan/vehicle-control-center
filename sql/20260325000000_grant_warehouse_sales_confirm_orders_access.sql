-- Migration: Grant 'warehouse' and 'sales' role access to manage orders and order_items
-- This is to support the "Confirm and Split Orders" (ConfirmOrderView) feature
-- for both Sales and Warehouse roles.

-- 1. Orders (Update status to 'awaiting_dispatch' and split operations)
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;

CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
);

CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
);

CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
);

-- 2. Order Items (Insert new items on split, update existing ones)
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;

CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
);

CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
);

CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales', 'warehouse'))
);

-- Add comments for documentation
COMMENT ON POLICY "orders_update" ON public.orders IS 'Allow admin, manager, sales, and warehouse to update orders.';
COMMENT ON POLICY "order_items_update" ON public.order_items IS 'Allow admin, manager, sales, and warehouse to update order items.';
