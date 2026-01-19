-- Update RLS policies to support 'sales' role
-- This migration updates policies for stores, products, customer_tiers, and product_tier_prices
-- to allow sales team to access and manage sales-related data

BEGIN;

-- ========================================
-- 1. Update stores policies - allow sales to view
-- ========================================

-- Drop and recreate stores_select policy to include 'sales'
DROP POLICY IF EXISTS "stores_select" ON public.stores;

CREATE POLICY "stores_select"
ON public.stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales')
  )
);

-- ========================================
-- 2. Update products policies - allow sales to view
-- ========================================

-- Drop and recreate products_select policy to include 'sales'
DROP POLICY IF EXISTS "products_select" ON public.products;

CREATE POLICY "products_select"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales')
  )
);

-- Allow sales to insert/update products (for managing product catalog)
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;

CREATE POLICY "products_insert"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
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
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales')
  )
);

-- ========================================
-- 3. Update customer_tiers policies - allow sales to view and manage
-- ========================================

-- Drop existing policies (including the new one if it already exists)
DROP POLICY IF EXISTS "Anyone can view customer tiers" ON public.customer_tiers;
DROP POLICY IF EXISTS "Admin can manage customer tiers" ON public.customer_tiers;
DROP POLICY IF EXISTS "Admin and sales can manage customer tiers" ON public.customer_tiers;

-- Recreate with sales support
CREATE POLICY "Anyone can view customer tiers" 
  ON public.customer_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and sales can manage customer tiers" 
  ON public.customer_tiers FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  );

-- ========================================
-- 4. Update product_tier_prices policies - allow sales to view and manage
-- ========================================

-- Drop existing policies (including the new one if it already exists)
DROP POLICY IF EXISTS "Anyone can view product tier prices" ON public.product_tier_prices;
DROP POLICY IF EXISTS "Admin can manage product tier prices" ON public.product_tier_prices;
DROP POLICY IF EXISTS "Admin and sales can manage product tier prices" ON public.product_tier_prices;

-- Recreate with sales support
CREATE POLICY "Anyone can view product tier prices" 
  ON public.product_tier_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and sales can manage product tier prices" 
  ON public.product_tier_prices FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  );

COMMENT ON POLICY "stores_select" ON public.stores IS 
  'Allow sales team to view stores for order creation';

COMMENT ON POLICY "products_select" ON public.products IS 
  'Allow sales team to view products for order creation';

COMMENT ON POLICY "products_insert" ON public.products IS 
  'Allow sales team to add new products';

COMMENT ON POLICY "products_update" ON public.products IS 
  'Allow sales team to update product information';

COMMENT ON POLICY "Admin and sales can manage customer tiers" ON public.customer_tiers IS 
  'Allow sales team to manage customer tier settings';

COMMENT ON POLICY "Admin and sales can manage product tier prices" ON public.product_tier_prices IS 
  'Allow sales team to manage product pricing by customer tier';

COMMIT;
