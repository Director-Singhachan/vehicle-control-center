-- ========================================
-- Fix trip_edit_history INSERT RLS Policy
-- แก้ไข INSERT policy สำหรับ trip_edit_history ให้ปลอดภัยขึ้น
-- ========================================
-- 
-- ⚠️ PROBLEM: Current INSERT policy uses WITH CHECK (true)
-- This allows any authenticated user to insert audit logs
-- 
-- ✅ SOLUTION: Restrict INSERT to users who have permission to edit trips
-- Only allow INSERT when:
-- 1. edited_by = auth.uid() (user is recording their own edit)
-- 2. OR user has role that can edit trips (admin, manager, inspector)
-- ========================================

-- ========================================
-- 1. DROP EXISTING OVERLY PERMISSIVE INSERT POLICY
-- ========================================
DO $$
BEGIN
  -- Drop existing INSERT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'trip_edit_history'
      AND policyname LIKE '%insert%'
  ) THEN
    -- Drop all INSERT policies (there might be multiple)
    DROP POLICY IF EXISTS "trip_edit_history insert authenticated" ON public.trip_edit_history;
    DROP POLICY IF EXISTS "trip_edit_history_insert" ON public.trip_edit_history;
    DROP POLICY IF EXISTS "trip_edit_history insert" ON public.trip_edit_history;
    DROP POLICY IF EXISTS "Allow authenticated users to insert trip edit history" ON public.trip_edit_history;
    
    RAISE NOTICE '✅ Dropped existing INSERT policies';
  ELSE
    RAISE NOTICE 'ℹ️ No existing INSERT policy found';
  END IF;
END $$;

-- ========================================
-- 2. CREATE SECURE INSERT POLICY
-- ========================================
DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trip_edit_history'
  ) THEN
    -- Check if RLS is enabled
    IF EXISTS (
      SELECT 1 FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public' 
        AND t.tablename = 'trip_edit_history'
        AND c.relrowsecurity = true
    ) THEN
      -- Create secure INSERT policy
      -- Only allow INSERT when:
      -- 1. edited_by = auth.uid() (user is recording their own edit)
      -- 2. OR user has role that can edit trips (admin, manager, inspector)
      CREATE POLICY "trip_edit_history_insert" ON public.trip_edit_history
        FOR INSERT
        TO authenticated
        WITH CHECK (
          -- User must be recording their own edit
          edited_by = auth.uid()
          OR
          -- OR user has role that can edit trips
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'manager', 'inspector')
          )
        );
      
      COMMENT ON POLICY "trip_edit_history_insert" ON public.trip_edit_history IS 
        'Allow INSERT only when edited_by matches current user OR user has admin/manager/inspector role. This ensures audit logs are only created by authorized users.';
      
      RAISE NOTICE '✅ Created secure INSERT policy for trip_edit_history';
    ELSE
      RAISE WARNING '⚠️ RLS is not enabled for trip_edit_history table';
    END IF;
  ELSE
    RAISE WARNING '⚠️ trip_edit_history table does not exist';
  END IF;
END $$;

-- ========================================
-- 3. VERIFICATION
-- ========================================
DO $$
DECLARE
  policy_count INTEGER;
  has_secure_policy BOOLEAN := false;
BEGIN
  -- Check if secure policy exists
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename = 'trip_edit_history'
    AND policyname = 'trip_edit_history_insert'
    AND cmd = 'INSERT';
  
  IF policy_count > 0 THEN
    has_secure_policy := true;
    RAISE NOTICE '✅ Secure INSERT policy exists';
  ELSE
    RAISE WARNING '⚠️ Secure INSERT policy not found';
  END IF;
  
  -- Check for any remaining overly permissive INSERT policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename = 'trip_edit_history'
    AND cmd = 'INSERT'
    AND (qual IS NULL OR qual = 'true' OR qual = '(true)')
    AND (with_check IS NULL OR with_check = 'true' OR with_check = '(true)');
  
  IF policy_count > 0 THEN
    RAISE WARNING '⚠️ Found % overly permissive INSERT policies', policy_count;
  ELSE
    RAISE NOTICE '✅ No overly permissive INSERT policies found';
  END IF;
  
  RAISE NOTICE '========================================';
  IF has_secure_policy THEN
    RAISE NOTICE '✅ trip_edit_history INSERT policy is now secure!';
  ELSE
    RAISE WARNING '⚠️ Please check trip_edit_history INSERT policy manually';
  END IF;
  RAISE NOTICE '========================================';
END $$;
