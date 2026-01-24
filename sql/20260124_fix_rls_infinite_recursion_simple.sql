-- ========================================
-- 🚨 FIX: Infinite Recursion in RLS Policies
-- ========================================
-- ปัญหา: RLS policies query profiles ซ้ำทำให้เกิด infinite loop
-- แก้ไข: ใช้ functions ที่มีอยู่แล้ว (has_role, is_admin) 
--        แทนการ query profiles ซ้ำ
-- ========================================

-- ========================================
-- STEP 1: Fix RLS Policies (ใช้ functions ที่มีอยู่)
-- ========================================

-- =====================
-- Fix: profiles read for tickets view
-- ใช้ (select auth.uid()) เท่านั้น ไม่ query profiles
-- =====================

DROP POLICY IF EXISTS "profiles read for tickets view" ON public.profiles;

CREATE POLICY "profiles read for tickets view" ON public.profiles
  FOR SELECT
  USING (
    -- ใช้ (select auth.uid()) แทน auth.uid() สำหรับ performance
    -- แต่ไม่ query profiles ซ้ำเพื่อหลีกเลี่ยง infinite recursion
    (select auth.uid()) IS NOT NULL
  );

-- =====================
-- Fix: Users can view basic profile info  
-- ใช้ has_role() function ที่มีอยู่แล้ว
-- =====================

DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;

CREATE POLICY "Users can view basic profile info" ON public.profiles
  FOR SELECT
  USING (
    -- User can see themselves
    id = (select auth.uid())
    OR
    -- Staff can see everyone (use existing has_role function)
    -- Function parameters: has_role(user_id UUID, required_roles TEXT[])
    public.has_role(
      (select auth.uid()), 
      ARRAY['manager', 'executive', 'admin', 'inspector', 'driver']
    )
  );

-- =====================
-- Fix: profiles admin manage
-- ใช้ is_admin() function ที่มีอยู่แล้ว
-- =====================

DROP POLICY IF EXISTS "profiles admin manage" ON public.profiles;

CREATE POLICY "profiles admin manage" ON public.profiles
  FOR ALL
  USING (
    -- Use existing is_admin() function
    public.is_admin((select auth.uid()))
  )
  WITH CHECK (
    public.is_admin((select auth.uid()))
  );

-- ========================================
-- STEP 2: Verify Functions Exist
-- ========================================

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
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ INFINITE RECURSION FIX APPLIED';
  RAISE NOTICE '========================================';
  
  IF v_has_role_exists THEN
    RAISE NOTICE '✅ has_role() function exists';
  ELSE
    RAISE WARNING '⚠️ has_role() function does NOT exist';
  END IF;
  
  IF v_is_admin_exists THEN
    RAISE NOTICE '✅ is_admin() function exists';
  ELSE
    RAISE WARNING '⚠️ is_admin() function does NOT exist';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ========================================
-- STEP 3: Verify RLS Policies
-- ========================================

SELECT 
  '✅ RLS Policies' as check_type,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%has_role%' OR qual LIKE '%is_admin%' THEN '✅ Uses function (safe)'
    WHEN qual LIKE '%(select auth.uid())%' AND qual NOT LIKE '%FROM%profiles%' THEN '✅ Cached auth.uid() (safe)'
    WHEN qual LIKE '%FROM%profiles%' THEN '⚠️ May cause recursion'
    ELSE '❓ Check manually'
  END as safety_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ========================================
-- 📝 NOTES
-- ========================================
-- 
-- สิ่งที่แก้ไข:
-- 1. ✅ ใช้ (select auth.uid()) แทน auth.uid()
-- 2. ✅ ใช้ has_role() และ is_admin() ที่มีอยู่แล้ว
-- 3. ✅ ไม่ query profiles table ใน policy (หลีกเลี่ยง recursion)
-- 4. ✅ Functions เป็น SECURITY DEFINER = bypass RLS
--
-- ทำไมต้องใช้ functions:
-- - ❌ ห้าม: SELECT FROM profiles ใน policy → infinite loop
-- - ✅ ใช้: Functions ที่เป็น SECURITY DEFINER → bypass RLS
-- - ✅ Performance: ยังคงใช้ (select auth.uid()) cache
--
-- หลังจากรัน:
-- 1. รีเฟรชหน้า Dashboard (Ctrl+Shift+R)
-- 2. Error "infinite recursion" ควรหายไป
-- 3. tickets_with_relations ควรโหลดได้ปกติ
--
-- ========================================
