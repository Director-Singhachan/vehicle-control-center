-- ========================================
-- Fix RLS Policy Always True Warnings
-- Fixes overly permissive policies for:
-- 1. public.inventory_transactions
-- 2. public.tickets
-- 3. public.vehicle_alerts
-- ========================================

-- ========================================
-- 1. Fix inventory_transactions
-- ========================================

ALTER TABLE IF EXISTS public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Drop insecure/permissive policies
DROP POLICY IF EXISTS "auth_insert_inventory_tx" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Authorized users can insert inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Anyone can view inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Authenticated users can view inventory transactions" ON public.inventory_transactions;

-- Secure View Policy
CREATE POLICY "Authenticated users can view inventory transactions" 
ON public.inventory_transactions 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'user', 'inspector', 'driver', 'executive')
  )
);

-- Secure Insert Policy
CREATE POLICY "Authorized users can insert inventory transactions"
ON public.inventory_transactions 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'user', 'inspector', 'driver', 'executive')
  )
);

-- ========================================
-- 2. Fix tickets
-- ========================================

ALTER TABLE IF EXISTS public.tickets ENABLE ROW LEVEL SECURITY;

-- Drop potentially insecure policies
DROP POLICY IF EXISTS "tickets read" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can view tickets" ON public.tickets;
-- Drop any other "always true" policies that might exist
DROP POLICY IF EXISTS "Anyone can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can update tickets" ON public.tickets;

-- Secure View Policy
CREATE POLICY "tickets read" 
ON public.tickets 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Role-based access (Staff see all)
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'inspector', 'user', 'executive')
    )
    -- Drivers see tickets for vehicles they drive (active/recent trips) or if they reported it
    OR reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.trip_logs tl
      WHERE tl.vehicle_id = public.tickets.vehicle_id
      AND tl.driver_id = auth.uid()
    )
  )
);

-- Secure Insert Policy
-- Users can insert if they are authenticated, but we enforce reporter_id matching or role check
CREATE POLICY "tickets insert"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND (
    -- If setting reporter_id, it must match own ID (unless admin/manager/inspector)
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  )
);

-- Secure Update Policy
-- Only Admin/Manager/Inspector can update, or Owner if pending (optional, simplified here to roles)
CREATE POLICY "tickets update"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager', 'inspector')
  )
  OR (
    -- Reporter can update their own ticket if needed (e.g. status is still open)
    -- For safety, restricting to roles mostly, but allowing reporter update for now if that was intended
    reporter_id = auth.uid()
  )
);

-- ========================================
-- 3. Fix vehicle_alerts
-- ========================================

ALTER TABLE IF EXISTS public.vehicle_alerts ENABLE ROW LEVEL SECURITY;

-- Drop insecure policies
DROP POLICY IF EXISTS "vehicle_alerts read" ON public.vehicle_alerts;
DROP POLICY IF EXISTS "Anyone can view vehicle alerts" ON public.vehicle_alerts;
DROP POLICY IF EXISTS "vehicle_alerts insert" ON public.vehicle_alerts;
DROP POLICY IF EXISTS "vehicle_alerts update" ON public.vehicle_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to view alerts" ON public.vehicle_alerts;
DROP POLICY IF EXISTS "Allow authenticated users to update alerts" ON public.vehicle_alerts;

-- Secure View Policy
CREATE POLICY "vehicle_alerts read"
ON public.vehicle_alerts
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Staff can see all alerts
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'inspector', 'user', 'executive')
    )
    -- Drivers see alerts for vehicles they drive
    OR EXISTS (
      SELECT 1
      FROM public.trip_logs tl
      WHERE tl.vehicle_id = public.vehicle_alerts.vehicle_id
      AND tl.driver_id = auth.uid()
    )
  )
);

-- Secure Insert Policy
CREATE POLICY "vehicle_alerts insert"
ON public.vehicle_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

-- Secure Update Policy
CREATE POLICY "vehicle_alerts update"
ON public.vehicle_alerts
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector')
  )
);

-- Secure Delete Policy
CREATE POLICY "vehicle_alerts delete"
ON public.vehicle_alerts
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);
