-- ============================================================================
-- Grant SALES role full access to Sales Features tables
-- ให้สิทธิ์ role 'sales' ในการจัดการ (เพิ่ม/แก้ไข/ลบ) ข้อมูลในฟีเจอร์ฝ่ายขายทั้งหมด
-- ============================================================================

BEGIN;

-- 1. Customer Tiers (customer_tiers) - ระดับลูกค้า
-- ============================================================================
DROP POLICY IF EXISTS "customer_tiers_select" ON public.customer_tiers;
DROP POLICY IF EXISTS "customer_tiers_insert" ON public.customer_tiers;
DROP POLICY IF EXISTS "customer_tiers_update" ON public.customer_tiers;
DROP POLICY IF EXISTS "customer_tiers_delete" ON public.customer_tiers;
DROP POLICY IF EXISTS "customer_tiers_all" ON public.customer_tiers; 
DROP POLICY IF EXISTS "Admin and sales can manage product tier prices" ON public.customer_tiers;

-- Allow SELECT to everyone (authenticated)
CREATE POLICY "customer_tiers_select"
ON public.customer_tiers
FOR SELECT
TO authenticated
USING (true);

-- Allow INSERT/UPDATE/DELETE for admin, manager, sales
CREATE POLICY "customer_tiers_insert"
ON public.customer_tiers
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "customer_tiers_update"
ON public.customer_tiers
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "customer_tiers_delete"
ON public.customer_tiers
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);


-- 2. Stores (stores) - ลูกค้า/ร้านค้า
-- ============================================================================
DROP POLICY IF EXISTS "stores_select" ON public.stores;
DROP POLICY IF EXISTS "stores_insert" ON public.stores;
DROP POLICY IF EXISTS "stores_update" ON public.stores;
DROP POLICY IF EXISTS "stores_delete" ON public.stores;

CREATE POLICY "stores_select" ON public.stores FOR SELECT TO authenticated USING (true);

CREATE POLICY "stores_insert" ON public.stores FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "stores_update" ON public.stores FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "stores_delete" ON public.stores FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);


-- 3. Orders (orders) - ออเดอร์
-- ============================================================================
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
DROP POLICY IF EXISTS "Orders are viewable by everyone" ON public.orders;

CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);


-- 4. Order Items (order_items) - รายการในออเดอร์
-- ============================================================================
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'sales'))
);

-- 5. Products (products) - สินค้า (แก้ไขราคา/ต้นทุน)
-- ============================================================================
-- Note: 'sales' role needs to edit products (prices), but maybe not delete?
-- Request said "create edit everything in sales features".
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;

CREATE POLICY "products_insert"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales')
  )
);

CREATE POLICY "products_update"
ON public.products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales')
  )
);

-- 6. Product Tier Prices (product_tier_prices) - ราคาตามระดับลูกค้า
-- ============================================================================
DROP POLICY IF EXISTS "Admin and sales can manage product tier prices" ON public.product_tier_prices;
DROP POLICY IF EXISTS "Admin can manage product tier prices" ON public.product_tier_prices;

CREATE POLICY "Admin and sales can manage product tier prices" 
  ON public.product_tier_prices FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  );

DO $$
BEGIN
    RAISE NOTICE 'Updated RLS policies for Sales role: Stores, Customers, Orders, Items, Products, and Pricing.';
END $$;

COMMIT;
