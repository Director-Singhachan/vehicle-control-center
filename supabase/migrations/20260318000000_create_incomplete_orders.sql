-- 20260318000000_create_incomplete_orders.sql
-- Create incomplete_orders table to store orders with errors during upload

CREATE TABLE IF NOT EXISTS public.incomplete_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_no TEXT,
    order_date DATE,
    customer_name TEXT,
    customer_code TEXT,
    net_value NUMERIC(15, 2),
    items JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    status TEXT DEFAULT 'pending',
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    branch TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_status ON public.incomplete_orders(status);
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_created_at ON public.incomplete_orders(created_at);

-- Enable RLS
ALTER TABLE public.incomplete_orders ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (Simplified for internal staff use)
DROP POLICY IF EXISTS "Everyone can view incomplete_orders" ON public.incomplete_orders;
CREATE POLICY "Everyone can view incomplete_orders" 
ON public.incomplete_orders FOR SELECT 
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert incomplete_orders" ON public.incomplete_orders;
CREATE POLICY "Authenticated users can insert incomplete_orders" 
ON public.incomplete_orders FOR INSERT 
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update incomplete_orders" ON public.incomplete_orders;
CREATE POLICY "Authenticated users can update incomplete_orders" 
ON public.incomplete_orders FOR UPDATE 
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete incomplete_orders" ON public.incomplete_orders;
CREATE POLICY "Authenticated users can delete incomplete_orders" 
ON public.incomplete_orders FOR DELETE 
TO authenticated
USING (true);
