-- ========================================
-- Force Fix RLS Policy Always True Warnings
-- บังคับแก้ไข RLS Policy warnings โดยลบ policies ทั้งหมดแล้วสร้างใหม่
-- ========================================
-- 
-- This script will:
-- 1. Drop ALL policies on the three tables
-- 2. Create new, secure policies
-- 3. Ensure no USING (true) remains
-- ========================================

-- ========================================
-- 1. inventory_transactions
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
        AND tablename = 'inventory_transactions'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.inventory_transactions', r.policyname);
    END LOOP;
END $$;

-- Create new secure policies
CREATE POLICY "inventory_transactions_select"
ON public.inventory_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'user', 'inspector', 'driver', 'executive')
  )
);

CREATE POLICY "inventory_transactions_insert"
ON public.inventory_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'user', 'inspector', 'driver', 'executive')
  )
);

CREATE POLICY "inventory_transactions_update"
ON public.inventory_transactions
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

CREATE POLICY "inventory_transactions_delete"
ON public.inventory_transactions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);

-- ========================================
-- 2. tickets
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
        AND tablename = 'tickets'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tickets', r.policyname);
    END LOOP;
END $$;

-- Create new secure policies
CREATE POLICY "tickets_select"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  -- Role-based access
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
  -- Or ticket reporter
  OR reporter_id = auth.uid()
  -- Or driver of the vehicle
  OR EXISTS (
    SELECT 1
    FROM public.trip_logs tl
    WHERE tl.vehicle_id = public.tickets.vehicle_id
    AND tl.driver_id = auth.uid()
  )
);

CREATE POLICY "tickets_insert"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
);

CREATE POLICY "tickets_update"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
  OR reporter_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
  OR reporter_id = auth.uid()
);

CREATE POLICY "tickets_delete"
ON public.tickets
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);

-- ========================================
-- 3. vehicle_alerts
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
        AND tablename = 'vehicle_alerts'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicle_alerts', r.policyname);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.vehicle_alerts ENABLE ROW LEVEL SECURITY;

-- Create new secure policies
CREATE POLICY "vehicle_alerts_select"
ON public.vehicle_alerts
FOR SELECT
TO authenticated
USING (
  -- Role-based access
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive')
  )
  -- Or driver of the vehicle
  OR EXISTS (
    SELECT 1
    FROM public.trip_logs tl
    WHERE tl.vehicle_id = public.vehicle_alerts.vehicle_id
    AND tl.driver_id = auth.uid()
  )
);

CREATE POLICY "vehicle_alerts_insert"
ON public.vehicle_alerts
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

CREATE POLICY "vehicle_alerts_update"
ON public.vehicle_alerts
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

CREATE POLICY "vehicle_alerts_delete"
ON public.vehicle_alerts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);

-- ========================================
-- Verification
-- ========================================
-- Run this to verify no USING (true) remains:
-- 
-- SELECT tablename, policyname, qual as using_expression
-- FROM pg_policies
-- WHERE tablename IN ('inventory_transactions', 'tickets', 'vehicle_alerts')
-- AND qual = 'true'::text;
-- 
-- Should return 0 rows
-- ========================================
