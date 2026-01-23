-- ========================================
-- Fix RLS Performance: Replace auth.uid() with (select auth.uid())
-- แก้ไข RLS policies เพื่อเพิ่มประสิทธิภาพโดยใช้ (select auth.uid())
-- ========================================
-- 
-- ⚠️ PROBLEM: 
-- RLS policies ใช้ auth.uid() โดยตรง ทำให้ต้อง evaluate ทุก row
-- 
-- ✅ SOLUTION:
-- เปลี่ยน auth.uid() เป็น (select auth.uid()) เพื่อให้ evaluate แค่ครั้งเดียว
-- 
-- ⚠️ NOTE:
-- PostgreSQL ไม่สามารถ ALTER POLICY expression ได้โดยตรง
-- ต้อง DROP และ CREATE ใหม่ แต่จะทำทีละ policy เพื่อความปลอดภัย
-- ========================================

-- ========================================
-- IMPORTANT: This script fixes the most critical policies
-- For complete fix, you may need to run this multiple times
-- or manually fix remaining policies
-- ========================================

-- ========================================
-- 1. FIX VEHICLES TABLE POLICIES
-- ========================================

-- Fix "vehicles read all" policy
DO $$
BEGIN
  -- Drop existing policy
  DROP POLICY IF EXISTS "vehicles read all" ON public.vehicles;
  
  -- Recreate with optimized expression
  CREATE POLICY "vehicles read all"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
  );
  
  RAISE NOTICE '✅ Fixed: vehicles read all';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing vehicles read all: %', SQLERRM;
END $$;

-- Fix "vehicles write manager" policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "vehicles write manager" ON public.vehicles;
  
  CREATE POLICY "vehicles write manager"
  ON public.vehicles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager')
    )
  );
  
  RAISE NOTICE '✅ Fixed: vehicles write manager';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing vehicles write manager: %', SQLERRM;
END $$;

-- ========================================
-- 2. FIX TRIP_EDIT_HISTORY POLICIES
-- ========================================

-- Fix "trip_edit_history_insert" policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "trip_edit_history_insert" ON public.trip_edit_history;
  
  CREATE POLICY "trip_edit_history_insert"
  ON public.trip_edit_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    edited_by = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'inspector')
    )
  );
  
  RAISE NOTICE '✅ Fixed: trip_edit_history_insert';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing trip_edit_history_insert: %', SQLERRM;
END $$;

-- Fix "trip_edit_history update admin only" policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "trip_edit_history update admin only" ON public.trip_edit_history;
  
  CREATE POLICY "trip_edit_history update admin only"
  ON public.trip_edit_history
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  );
  
  RAISE NOTICE '✅ Fixed: trip_edit_history update admin only';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing trip_edit_history update admin only: %', SQLERRM;
END $$;

-- Fix "trip_edit_history delete admin only" policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "trip_edit_history delete admin only" ON public.trip_edit_history;
  
  CREATE POLICY "trip_edit_history delete admin only"
  ON public.trip_edit_history
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  );
  
  RAISE NOTICE '✅ Fixed: trip_edit_history delete admin only';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing trip_edit_history delete admin only: %', SQLERRM;
END $$;

-- ========================================
-- 3. FIX TRIP_LOGS POLICIES (Critical for performance)
-- ========================================

-- Fix "Users can view all trips" policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view all trips" ON public.trip_logs;
  
  CREATE POLICY "Users can view all trips"
  ON public.trip_logs
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
  );
  
  RAISE NOTICE '✅ Fixed: Users can view all trips';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing Users can view all trips: %', SQLERRM;
END $$;

-- Fix "Drivers can update own trips" policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Drivers can update own trips" ON public.trip_logs;
  
  CREATE POLICY "Drivers can update own trips"
  ON public.trip_logs
  FOR UPDATE
  TO authenticated
  USING (
    driver_id = (select auth.uid())
  )
  WITH CHECK (
    driver_id = (select auth.uid())
  );
  
  RAISE NOTICE '✅ Fixed: Drivers can update own trips';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing Drivers can update own trips: %', SQLERRM;
END $$;

-- Fix "Drivers can create trips" policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Drivers can create trips" ON public.trip_logs;
  
  CREATE POLICY "Drivers can create trips"
  ON public.trip_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = (select auth.uid())
  );
  
  RAISE NOTICE '✅ Fixed: Drivers can create trips';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error fixing Drivers can create trips: %', SQLERRM;
END $$;

-- ========================================
-- 4. VERIFICATION
-- ========================================
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  -- Count policies still using auth.uid() directly (excluding ones we just fixed)
  SELECT COUNT(*) INTO remaining_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual LIKE '%auth.uid()%' 
      OR qual LIKE '%auth.role()%'
      OR with_check LIKE '%auth.uid()%'
      OR with_check LIKE '%auth.role()%'
    )
    AND qual NOT LIKE '%(select auth.uid())%'
    AND qual NOT LIKE '%(select auth.role())%'
    AND with_check NOT LIKE '%(select auth.uid())%'
    AND with_check NOT LIKE '%(select auth.role())%';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Verification Results:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Policies still using auth.uid() directly: %', remaining_count;
  
  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ All critical policies fixed!';
  ELSE
    RAISE WARNING '⚠️ % policies still need fixing', remaining_count;
    RAISE NOTICE '💡 Run this script multiple times or fix remaining policies manually';
  END IF;
  RAISE NOTICE '========================================';
END $$;
