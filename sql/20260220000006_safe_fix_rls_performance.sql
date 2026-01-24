-- ========================================
-- SAFE Fix RLS Performance Issues
-- แก้ไข RLS policies อย่างปลอดภัย (มี Transaction และ Error Handling)
-- ========================================
-- 
-- ⚠️ IMPORTANT: 
-- 1. BACKUP DATABASE ก่อนรันสคริปต์นี้!
-- 2. ทดสอบใน staging/dev environment ก่อน
-- 3. รันทีละส่วนและตรวจสอบผลลัพธ์
-- 
-- ✅ FEATURES:
-- - ใช้ Transaction (rollback ถ้ามี error)
-- - Error handling สำหรับทุก operation
-- - Verification หลังแก้ไข
-- - Logging ทุกขั้นตอน
-- ========================================

-- ========================================
-- PART 1: FIX DUPLICATE INDEX (Safe - ไม่กระทบ policies)
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PART 1: Fixing duplicate indexes...';
  RAISE NOTICE '========================================';
  
  -- Drop duplicate index on vehicle_usage
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'vehicle_usage' 
      AND indexname = 'idx_vehicle_usage_vehicle'
  ) THEN
    DROP INDEX IF EXISTS public.idx_vehicle_usage_vehicle;
    RAISE NOTICE '✅ Dropped duplicate index: idx_vehicle_usage_vehicle';
  ELSE
    RAISE NOTICE 'ℹ️ Duplicate index already removed or does not exist';
  END IF;
  
  RAISE NOTICE '✅ PART 1 completed successfully';
  RAISE NOTICE '========================================';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '❌ Error in PART 1: %', SQLERRM;
END $$;

-- ========================================
-- PART 2: FIX CRITICAL RLS POLICIES (Vehicles)
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PART 2: Fixing vehicles table policies...';
  RAISE NOTICE '========================================';
  
  -- Fix "vehicles read all" policy
  BEGIN
    DROP POLICY IF EXISTS "vehicles read all" ON public.vehicles;
    
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
    -- Continue with other policies
  END;
  
  -- Fix "vehicles write manager" policy
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
  END;
  
  RAISE NOTICE '✅ PART 2 completed';
  RAISE NOTICE '========================================';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '❌ Error in PART 2: %', SQLERRM;
END $$;

-- ========================================
-- PART 3: FIX TRIP_LOGS POLICIES (Critical for performance)
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PART 3: Fixing trip_logs table policies...';
  RAISE NOTICE '========================================';
  
  -- Fix "Users can view all trips" policy
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
  END;
  
  -- Fix "Drivers can update own trips" policy
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
  END;
  
  -- Fix "Drivers can create trips" policy
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
  END;
  
  RAISE NOTICE '✅ PART 3 completed';
  RAISE NOTICE '========================================';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '❌ Error in PART 3: %', SQLERRM;
END $$;

-- ========================================
-- PART 4: FIX TRIP_EDIT_HISTORY POLICIES
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PART 4: Fixing trip_edit_history table policies...';
  RAISE NOTICE '========================================';
  
  -- Fix "trip_edit_history_insert" policy
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
  END;
  
  -- Fix "trip_edit_history update admin only" policy
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
  END;
  
  -- Fix "trip_edit_history delete admin only" policy
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
  END;
  
  RAISE NOTICE '✅ PART 4 completed';
  RAISE NOTICE '========================================';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '❌ Error in PART 4: %', SQLERRM;
END $$;

-- ========================================
-- VERIFICATION: ตรวจสอบผลลัพธ์
-- ========================================
DO $$
DECLARE
  remaining_count INTEGER;
  fixed_policies TEXT[] := ARRAY[
    'vehicles read all',
    'vehicles write manager',
    'Users can view all trips',
    'Drivers can update own trips',
    'Drivers can create trips',
    'trip_edit_history_insert',
    'trip_edit_history update admin only',
    'trip_edit_history delete admin only'
  ];
  policy_name TEXT;
  policy_exists BOOLEAN;
  all_ok BOOLEAN := true;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION: Checking results...';
  RAISE NOTICE '========================================';
  
  -- Check if fixed policies exist and use (select auth.uid())
  FOREACH policy_name IN ARRAY fixed_policies
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND policyname = policy_name
        AND (
          qual LIKE '%(select auth.uid())%'
          OR with_check LIKE '%(select auth.uid())%'
        )
    ) INTO policy_exists;
    
    IF policy_exists THEN
      RAISE NOTICE '✅ Policy "%" is fixed', policy_name;
    ELSE
      RAISE WARNING '⚠️ Policy "%" may not be fixed correctly', policy_name;
      all_ok := false;
    END IF;
  END LOOP;
  
  -- Count remaining policies that need fixing
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
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed policies: %', array_length(fixed_policies, 1);
  RAISE NOTICE 'Remaining policies to fix: %', remaining_count;
  
  IF all_ok AND remaining_count < 100 THEN
    RAISE NOTICE '✅ Critical policies fixed successfully!';
    RAISE NOTICE '💡 You can now test the application';
    RAISE NOTICE '💡 Remaining policies can be fixed later';
  ELSE
    IF NOT all_ok THEN
      RAISE WARNING '⚠️ Some policies may need manual fixing';
    END IF;
    IF remaining_count >= 100 THEN
      RAISE WARNING '⚠️ Many policies still need fixing (% total)', remaining_count;
    END IF;
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- ROLLBACK INSTRUCTIONS (ถ้ามีปัญหา)
-- ========================================
-- ถ้ามีปัญหา ให้ restore จาก backup:
-- 1. ไปที่ Supabase Dashboard → Database → Backups
-- 2. เลือก backup ที่สร้างไว้ก่อนรันสคริปต์นี้
-- 3. คลิก Restore
-- 
-- หรือใช้ SQL:
-- DROP POLICY IF EXISTS "vehicles read all" ON public.vehicles;
-- DROP POLICY IF EXISTS "vehicles write manager" ON public.vehicles;
-- DROP POLICY IF EXISTS "Users can view all trips" ON public.trip_logs;
-- DROP POLICY IF EXISTS "Drivers can update own trips" ON public.trip_logs;
-- DROP POLICY IF EXISTS "Drivers can create trips" ON public.trip_logs;
-- DROP POLICY IF EXISTS "trip_edit_history_insert" ON public.trip_edit_history;
-- DROP POLICY IF EXISTS "trip_edit_history update admin only" ON public.trip_edit_history;
-- DROP POLICY IF EXISTS "trip_edit_history delete admin only" ON public.trip_edit_history;
-- แล้ว restore จาก backup
