-- ========================================
-- 🚨 ROLLBACK: Fix Infinite Recursion in RLS Policies
-- ========================================
-- ปัญหา: RLS policies ที่แก้ไขล่าสุดสร้าง infinite recursion
-- เพราะ policy มี subquery ที่ query profiles table อีกครั้ง
--
-- แก้ไข: ใช้ functions (has_role, is_admin) แทน
-- เพราะ functions ไม่ trigger RLS policies
-- ========================================

-- ========================================
-- STEP 1: Rollback RLS Policies
-- ========================================

-- =====================
-- Fix: profiles read for tickets view
-- ใช้ (select auth.uid()) แต่ไม่ query profiles ซ้ำ
-- =====================

DROP POLICY IF EXISTS "profiles read for tickets view" ON public.profiles;

CREATE POLICY "profiles read for tickets view" ON public.profiles
  FOR SELECT
  USING (
    -- ใช้ (select auth.uid()) แทน auth.uid() สำหรับ performance
    -- แต่ไม่ query profiles ซ้ำเพื่อหลีกเลี่ยง infinite recursion
    (select auth.uid()) IS NOT NULL
  );

COMMENT ON POLICY "profiles read for tickets view" ON public.profiles IS 
'Optimized: Allows authenticated users to view profiles. Uses (select auth.uid()) for better performance.';

-- =====================
-- Fix: Users can view basic profile info
-- ใช้ has_role() function แทน subquery
-- =====================

DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;

CREATE POLICY "Users can view basic profile info" ON public.profiles
  FOR SELECT
  USING (
    -- User can see themselves
    id = (select auth.uid())
    OR
    -- Staff can see everyone (use function to avoid recursion)
    public.has_role((select auth.uid()), ARRAY['manager', 'executive', 'admin', 'inspector', 'driver'])
  );

COMMENT ON POLICY "Users can view basic profile info" ON public.profiles IS 
'Optimized: Users can view their own profile, or all profiles if they have staff role. Uses has_role() function to avoid infinite recursion.';

-- =====================
-- Fix: profiles admin manage
-- ใช้ is_admin() function แทน subquery
-- =====================

DROP POLICY IF EXISTS "profiles admin manage" ON public.profiles;

CREATE POLICY "profiles admin manage" ON public.profiles
  FOR ALL
  USING (
    -- Use is_admin() function to avoid recursion
    public.is_admin((select auth.uid()))
  )
  WITH CHECK (
    public.is_admin((select auth.uid()))
  );

COMMENT ON POLICY "profiles admin manage" ON public.profiles IS 
'Optimized: Admins can manage all profiles. Uses is_admin() function to avoid infinite recursion.';

-- ========================================
-- STEP 2: Verify Functions Exist
-- ========================================

-- ตรวจสอบว่า has_role() และ is_admin() functions มีอยู่
DO $$
DECLARE
  v_has_role_exists BOOLEAN;
  v_is_admin_exists BOOLEAN;
BEGIN
  -- Check has_role function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname = 'has_role'
  ) INTO v_has_role_exists;
  
  -- Check is_admin function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname = 'is_admin'
  ) INTO v_is_admin_exists;
  
  IF v_has_role_exists THEN
    RAISE NOTICE '✅ has_role() function exists';
  ELSE
    RAISE WARNING '⚠️ has_role() function does NOT exist - creating it...';
  END IF;
  
  IF v_is_admin_exists THEN
    RAISE NOTICE '✅ is_admin() function exists';
  ELSE
    RAISE WARNING '⚠️ is_admin() function does NOT exist - creating it...';
  END IF;
END $$;

-- ========================================
-- STEP 3: Recreate Functions (DROP first to handle parameter name changes)
-- ========================================

-- DROP existing functions first (to handle parameter name changes)
DROP FUNCTION IF EXISTS public.has_role(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.is_admin(UUID);

-- Recreate has_role() function
CREATE FUNCTION public.has_role(user_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role directly from profiles table
  -- SECURITY DEFINER allows bypassing RLS to avoid recursion
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = user_id;
  
  -- Check if user role is in allowed roles
  RETURN user_role = ANY(allowed_roles);
END;
$$;

-- Recreate is_admin() function
CREATE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Use has_role function
  RETURN public.has_role(user_id, ARRAY['admin']);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- ========================================
-- STEP 4: Verify Results
-- ========================================

-- ตรวจสอบ policies
SELECT 
  '✅ RLS Policies Fixed' as status,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN '✅ Optimized (cached auth.uid())'
    WHEN qual LIKE '%has_role%' OR qual LIKE '%is_admin%' THEN '✅ Uses function (no recursion)'
    ELSE '⚠️ Check manually'
  END as implementation
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ========================================
-- 📝 NOTES
-- ========================================
-- 
-- สิ่งที่เปลี่ยน:
-- 1. ✅ ยังคงใช้ (select auth.uid()) เพื่อ performance
-- 2. ✅ ใช้ has_role() และ is_admin() functions แทน subquery
-- 3. ✅ Functions เหล่านี้เป็น SECURITY DEFINER ไม่ trigger RLS
-- 4. ✅ หลีกเลี่ยง infinite recursion
--
-- ทำไมถึงใช้ functions:
-- - Functions ที่เป็น SECURITY DEFINER จะ bypass RLS
-- - ไม่ทำให้เกิด recursion loop
-- - ยังคง performance ดีเพราะ cache auth.uid()
--
-- ========================================
