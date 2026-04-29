-- ========================================
-- Fix RLS Recursion and Grant Full Dev Access
-- Migration: 20260429000002_fix_rls_recursion_and_dev_access.sql
-- ========================================

BEGIN;

-- ========================================
-- 1. Helper Functions (SECURITY DEFINER to avoid recursion)
-- ========================================

CREATE OR REPLACE FUNCTION public.is_dev(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND role = 'dev'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager_or_dev(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND role IN ('admin', 'manager', 'dev')
  );
$$;

-- ========================================
-- 2. Profiles (Fix Recursion)
-- ========================================

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
DROP POLICY IF EXISTS "profiles admin manage" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() 
    OR public.is_admin_or_manager_or_dev(auth.uid())
  );

CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager_or_dev(auth.uid()))
  WITH CHECK (public.is_admin_or_manager_or_dev(auth.uid()));

-- ========================================
-- 3. Master Access for Dev on Critical Tables
-- ========================================
-- This ensures Dev can ALWAYS see and manage these tables regardless of other policies.

-- Warehouses
DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
CREATE POLICY "warehouses_select" ON public.warehouses
  FOR SELECT TO authenticated
  USING (true); -- Everyone authenticated can see warehouses (standard)

DROP POLICY IF EXISTS "warehouses_dev_manage" ON public.warehouses;
CREATE POLICY "warehouses_dev_manage" ON public.warehouses
  FOR ALL TO authenticated
  USING (public.is_dev(auth.uid()))
  WITH CHECK (public.is_dev(auth.uid()));

-- Stores
DROP POLICY IF EXISTS "stores_dev_manage" ON public.stores;
CREATE POLICY "stores_dev_manage" ON public.stores
  FOR ALL TO authenticated
  USING (public.is_dev(auth.uid()))
  WITH CHECK (public.is_dev(auth.uid()));

-- Products
DROP POLICY IF EXISTS "products_dev_manage" ON public.products;
CREATE POLICY "products_dev_manage" ON public.products
  FOR ALL TO authenticated
  USING (public.is_dev(auth.uid()))
  WITH CHECK (public.is_dev(auth.uid()));

-- Orders
DROP POLICY IF EXISTS "orders_dev_manage" ON public.orders;
CREATE POLICY "orders_dev_manage" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_dev(auth.uid()))
  WITH CHECK (public.is_dev(auth.uid()));

-- ========================================
-- 4. Update Existing Policies to include Dev safely
-- ========================================

-- Warehouses (Recreate standard select if needed)
-- (Already handled by "true" above for select)

-- Orders Select
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_manager_or_dev(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('inspector', 'executive', 'sales', 'warehouse')
    )
  );

COMMIT;
