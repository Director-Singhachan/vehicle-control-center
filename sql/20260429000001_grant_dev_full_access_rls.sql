-- ========================================
-- Grant Full RLS Access to 'dev' Role
-- Migration: 20260429000001_grant_dev_full_access_rls.sql
-- ========================================

BEGIN;

-- ========================================
-- 1. profiles
-- ========================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'dev')
  );

-- ========================================
-- 2. warehouses
-- ========================================
DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
CREATE POLICY "warehouses_select" ON public.warehouses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales', 'inspector', 'user', 'driver', 'executive', 'dev')
    )
  );

DROP POLICY IF EXISTS "warehouses_insert" ON public.warehouses;
CREATE POLICY "warehouses_insert" ON public.warehouses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'dev')
    )
  );

DROP POLICY IF EXISTS "warehouses_update" ON public.warehouses;
CREATE POLICY "warehouses_update" ON public.warehouses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'dev')
    )
  );

-- ========================================
-- 3. stores
-- ========================================
DROP POLICY IF EXISTS "stores_select" ON public.stores;
CREATE POLICY "stores_select" ON public.stores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales', 'dev')
    )
  );

DROP POLICY IF EXISTS "stores_insert" ON public.stores;
CREATE POLICY "stores_insert" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales', 'dev')
    )
  );

DROP POLICY IF EXISTS "stores_update" ON public.stores;
CREATE POLICY "stores_update" ON public.stores
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales', 'dev')
    )
  );

-- ========================================
-- 4. products
-- ========================================
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales', 'dev')
    )
  );

-- ========================================
-- 5. orders & order_items
-- ========================================
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'executive', 'sales', 'warehouse', 'dev')
    )
  );

DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales', 'dev')
    )
  );

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'executive', 'sales', 'warehouse', 'dev')
    )
  );

-- ========================================
-- 6. delivery_trips, stores, items
-- ========================================
DROP POLICY IF EXISTS "delivery_trips_select" ON public.delivery_trips;
CREATE POLICY "delivery_trips_select" ON public.delivery_trips
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales', 'dev')
    )
    OR driver_id = auth.uid()
  );

DROP POLICY IF EXISTS "delivery_trip_stores_select" ON public.delivery_trip_stores;
CREATE POLICY "delivery_trip_stores_select" ON public.delivery_trip_stores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales', 'dev')
    )
  );

-- ========================================
-- 7. inventory & transactions
-- ========================================
DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'warehouse', 'dev')
    )
  );

DROP POLICY IF EXISTS "inventory_transactions_select" ON public.inventory_transactions;
CREATE POLICY "inventory_transactions_select" ON public.inventory_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'warehouse', 'dev')
    )
  );

COMMIT;
