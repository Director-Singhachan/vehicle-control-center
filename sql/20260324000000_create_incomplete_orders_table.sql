-- ========================================
-- Create Incomplete Orders Table
-- For storing orders that failed validation during upload
-- ========================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.incomplete_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_no TEXT NOT NULL,
    order_date DATE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_code TEXT NOT NULL,
    net_value DECIMAL(12, 2) DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'deleted')),
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    branch TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_doc_no ON public.incomplete_orders(doc_no);
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_customer_code ON public.incomplete_orders(customer_code);
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_status ON public.incomplete_orders(status);
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_warehouse_id ON public.incomplete_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_branch ON public.incomplete_orders(branch);

-- 3. Enable RLS
ALTER TABLE public.incomplete_orders ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow authenticated users to select (Sales/Admin/Manager)
CREATE POLICY "Staff can view incomplete orders" ON public.incomplete_orders
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('sales', 'manager', 'admin', 'inspector')
        )
    );

-- Allow authenticated users with appropriate roles to insert
CREATE POLICY "Staff can insert incomplete orders" ON public.incomplete_orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('sales', 'manager', 'admin')
        )
    );

-- Allow appropriate roles to update
CREATE POLICY "Staff can update incomplete orders" ON public.incomplete_orders
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('sales', 'manager', 'admin')
        )
    );

-- Allow appropriate roles to delete
CREATE POLICY "Staff can delete incomplete orders" ON public.incomplete_orders
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('manager', 'admin')
        )
    );

-- 5. Comments
COMMENT ON TABLE public.incomplete_orders IS 'ตารางเก็บข้อมูลออเดอร์ที่อัพโหลดแล้วพบข้อผิดพลาด รอนำเข้าใหม่';
