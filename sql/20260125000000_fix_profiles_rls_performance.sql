-- ========================================
-- Fix RLS Performance Issue: profiles read for tickets view
-- ========================================
-- Issue: Table public.profiles has a row level security policy 
-- "profiles read for tickets view" that re-evaluates auth.uid() for each row.
-- This produces suboptimal query performance at scale.
-- 
-- Solution: Replace auth.uid() with (select auth.uid()) to evaluate once per query.
-- ========================================

-- ========================================
-- STEP 1: Fix "profiles read for tickets view" Policy
-- ========================================

DROP POLICY IF EXISTS "profiles read for tickets view" ON public.profiles;

CREATE POLICY "profiles read for tickets view" ON public.profiles
  FOR SELECT
  USING (
    -- Allow if user is authenticated (for tickets_with_relations view)
    -- Use (select auth.uid()) instead of auth.uid() for better performance
    -- This evaluates once per query instead of once per row
    (select auth.uid()) IS NOT NULL
  );

-- ========================================
-- STEP 2: Fix "Users can view basic profile info" Policy
-- ========================================
-- Note: We only drop and recreate the policy, NOT the has_role function
-- The function will continue to work with the optimized policy

DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;

CREATE POLICY "Users can view basic profile info"
  ON public.profiles
  FOR SELECT
  USING (
    id = (select auth.uid()) -- User can see themselves
    OR
    public.has_role((select auth.uid()), ARRAY['manager', 'executive', 'admin', 'inspector']) -- Staff can see everyone
    OR
    public.has_role((select auth.uid()), ARRAY['driver']) -- Drivers can see other drivers' names
  );

-- ========================================
-- STEP 3: Fix "profiles admin manage" Policy
-- ========================================
-- Note: We only drop and recreate the policy, NOT the is_admin function
-- The function will continue to work with the optimized policy

DROP POLICY IF EXISTS "profiles admin manage" ON public.profiles;

CREATE POLICY "profiles admin manage" ON public.profiles
  FOR ALL
  USING (public.is_admin((select auth.uid())))
  WITH CHECK (public.is_admin((select auth.uid())));

-- ========================================
-- STEP 4: Verify all fixes
-- ========================================

-- Check all profiles policies for performance optimization

SELECT 
  policyname,
  cmd,
  CASE 
    WHEN (qual LIKE '%(select auth.uid())%' OR qual IS NULL) 
         AND (with_check LIKE '%(select auth.uid())%' OR with_check IS NULL) 
         AND (qual NOT LIKE '%auth.uid()%' OR qual IS NULL)
         AND (with_check NOT LIKE '%auth.uid()%' OR with_check IS NULL) THEN '✅ Optimized'
    WHEN qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%' THEN '⚠️ Needs optimization'
    ELSE '✅ No auth.uid()'
  END as performance_status,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ========================================
-- ถ้าเห็น ✅ Optimized = สำเร็จ!
-- ========================================
