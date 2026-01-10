-- ========================================
-- Fix Delivery System RLS Policies
-- แก้ไข RLS Policy สำหรับระบบจัดส่งสินค้า
-- ========================================
-- 
-- This script fixes USING (true) in delivery-related tables:
-- - delivery_trips
-- - delivery_trip_stores  
-- - delivery_trip_items
-- - stores
-- - products
-- ========================================

-- ========================================
-- 1. delivery_trips
-- ========================================

-- Drop ALL existing policies
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'delivery_trips'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.delivery_trips', r.policyname);
    END LOOP;
END $$;

-- Create new secure policies
CREATE POLICY "delivery_trips_select"
ON public.delivery_trips
FOR SELECT
TO authenticated
USING (
  -- All authenticated users can view delivery trips
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
  -- Or if they are the driver
  OR driver_id = auth.uid()
);

CREATE POLICY "delivery_trips_insert"
ON public.delivery_trips
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

CREATE POLICY "delivery_trips_update"
ON public.delivery_trips
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
  OR driver_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
  OR driver_id = auth.uid()
);

CREATE POLICY "delivery_trips_delete"
ON public.delivery_trips
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- ========================================
-- 2. delivery_trip_stores
-- ========================================

-- Drop ALL existing policies
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'delivery_trip_stores'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.delivery_trip_stores', r.policyname);
    END LOOP;
END $$;

-- Create new secure policies
CREATE POLICY "delivery_trip_stores_select"
ON public.delivery_trip_stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
);

CREATE POLICY "delivery_trip_stores_insert"
ON public.delivery_trip_stores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

CREATE POLICY "delivery_trip_stores_update"
ON public.delivery_trip_stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

CREATE POLICY "delivery_trip_stores_delete"
ON public.delivery_trip_stores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

-- ========================================
-- 3. delivery_trip_items
-- ========================================

-- Drop ALL existing policies
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'delivery_trip_items'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.delivery_trip_items', r.policyname);
    END LOOP;
END $$;

-- Create new secure policies
CREATE POLICY "delivery_trip_items_select"
ON public.delivery_trip_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
);

CREATE POLICY "delivery_trip_items_insert"
ON public.delivery_trip_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

CREATE POLICY "delivery_trip_items_update"
ON public.delivery_trip_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

CREATE POLICY "delivery_trip_items_delete"
ON public.delivery_trip_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

-- ========================================
-- 4. stores
-- ========================================

-- Drop ALL existing policies
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'stores'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.stores', r.policyname);
    END LOOP;
END $$;

-- Create new secure policies
CREATE POLICY "stores_select"
ON public.stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
);

CREATE POLICY "stores_insert"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

CREATE POLICY "stores_update"
ON public.stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

CREATE POLICY "stores_delete"
ON public.stores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- ========================================
-- 5. products
-- ========================================

-- Drop ALL existing policies
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'products'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', r.policyname);
    END LOOP;
END $$;

-- Create new secure policies
CREATE POLICY "products_select"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
);

CREATE POLICY "products_insert"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
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
    AND p.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

CREATE POLICY "products_delete"
ON public.products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- ========================================
-- Verification
-- ========================================
-- Run this to verify no USING (true) remains in delivery system:
-- 
-- SELECT tablename, policyname, qual as using_expression
-- FROM pg_policies
-- WHERE tablename IN ('delivery_trips', 'delivery_trip_stores', 'delivery_trip_items', 'stores', 'products')
-- AND qual = 'true'::text;
-- 
-- Should return 0 rows
-- ========================================
