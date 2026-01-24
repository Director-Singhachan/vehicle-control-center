-- ========================================
-- 🚀 OPTIMIZE ALL 86 RLS POLICIES
-- ========================================
-- แก้ไข: แทนที่ auth.uid() ด้วย (select auth.uid())
-- เพื่อ cache value และ evaluate ครั้งเดียวต่อ query แทนที่จะเป็นทุก row
-- ========================================
-- วันที่: 2026-01-24
-- ========================================

-- ========================================
-- PART 1: FIX DUPLICATE INDEXES
-- ========================================

DROP INDEX IF EXISTS idx_fuel_records_vehicle;
DROP INDEX IF EXISTS idx_trip_logs_vehicle;

-- ========================================
-- PART 2: DYNAMIC RLS POLICY OPTIMIZER
-- ========================================
-- This function will automatically fix all RLS policies
-- that use auth.uid() without (select ...)

DO $$
DECLARE
    r RECORD;
    v_new_qual TEXT;
    v_new_with_check TEXT;
    v_policy_cmd TEXT;
    v_fixed_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🚀 Starting RLS Policy Optimization';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Loop through all policies that need optimization
    FOR r IN 
        SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
              (qual IS NOT NULL AND qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
              OR 
              (with_check IS NOT NULL AND with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
              OR
              (qual IS NOT NULL AND qual LIKE '%auth.role()%' AND qual NOT LIKE '%(select auth.role())%')
              OR 
              (with_check IS NOT NULL AND with_check LIKE '%auth.role()%' AND with_check NOT LIKE '%(select auth.role())%')
          )
    LOOP
        BEGIN
            -- Replace auth.uid() with (select auth.uid())
            v_new_qual := r.qual;
            v_new_with_check := r.with_check;
            
            IF v_new_qual IS NOT NULL THEN
                -- Replace auth.uid() but not already wrapped ones
                v_new_qual := REGEXP_REPLACE(v_new_qual, '([^(select ])auth\.uid\(\)', '(select auth.uid())', 'g');
                -- Also handle start of string
                v_new_qual := REGEXP_REPLACE(v_new_qual, '^auth\.uid\(\)', '(select auth.uid())', 'g');
                -- Replace auth.role()
                v_new_qual := REGEXP_REPLACE(v_new_qual, '([^(select ])auth\.role\(\)', '(select auth.role())', 'g');
                v_new_qual := REGEXP_REPLACE(v_new_qual, '^auth\.role\(\)', '(select auth.role())', 'g');
            END IF;
            
            IF v_new_with_check IS NOT NULL THEN
                v_new_with_check := REGEXP_REPLACE(v_new_with_check, '([^(select ])auth\.uid\(\)', '(select auth.uid())', 'g');
                v_new_with_check := REGEXP_REPLACE(v_new_with_check, '^auth\.uid\(\)', '(select auth.uid())', 'g');
                v_new_with_check := REGEXP_REPLACE(v_new_with_check, '([^(select ])auth\.role\(\)', '(select auth.role())', 'g');
                v_new_with_check := REGEXP_REPLACE(v_new_with_check, '^auth\.role\(\)', '(select auth.role())', 'g');
            END IF;

            -- Drop the old policy
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                r.policyname, r.schemaname, r.tablename);

            -- Build the CREATE POLICY command
            v_policy_cmd := format('CREATE POLICY %I ON %I.%I', 
                r.policyname, r.schemaname, r.tablename);
            
            -- Add AS clause
            IF r.permissive = 'PERMISSIVE' THEN
                v_policy_cmd := v_policy_cmd || ' AS PERMISSIVE';
            ELSE
                v_policy_cmd := v_policy_cmd || ' AS RESTRICTIVE';
            END IF;
            
            -- Add FOR clause
            v_policy_cmd := v_policy_cmd || format(' FOR %s', r.cmd);
            
            -- Add TO clause (roles)
            IF r.roles IS NOT NULL AND array_length(r.roles, 1) > 0 THEN
                v_policy_cmd := v_policy_cmd || ' TO ' || array_to_string(r.roles, ', ');
            END IF;
            
            -- Add USING clause
            IF v_new_qual IS NOT NULL THEN
                v_policy_cmd := v_policy_cmd || format(' USING (%s)', v_new_qual);
            END IF;
            
            -- Add WITH CHECK clause
            IF v_new_with_check IS NOT NULL THEN
                v_policy_cmd := v_policy_cmd || format(' WITH CHECK (%s)', v_new_with_check);
            END IF;

            -- Execute the CREATE POLICY
            EXECUTE v_policy_cmd;
            
            v_fixed_count := v_fixed_count + 1;
            RAISE NOTICE '✅ Fixed: %.% - %', r.tablename, r.policyname, r.cmd;
            
        EXCEPTION WHEN OTHERS THEN
            v_skipped_count := v_skipped_count + 1;
            RAISE WARNING '⚠️ Skipped: %.% - % (Error: %)', 
                r.tablename, r.policyname, r.cmd, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 OPTIMIZATION RESULTS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total Fixed: %', v_fixed_count;
    RAISE NOTICE 'Total Skipped: %', v_skipped_count;
    RAISE NOTICE '';
END $$;

-- ========================================
-- PART 3: VERIFY RESULTS
-- ========================================

-- Check remaining unoptimized policies
SELECT 
    '⚠️ Remaining unoptimized' as status,
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
      (qual IS NOT NULL AND qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
      OR 
      (with_check IS NOT NULL AND with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
  )
ORDER BY tablename, policyname;

-- Show count of optimized policies
SELECT 
    '✅ Optimized policies' as status,
    COUNT(*) as total_count
FROM pg_policies
WHERE schemaname = 'public'
  AND (
      (qual LIKE '%(select auth.uid())%')
      OR 
      (with_check LIKE '%(select auth.uid())%')
  );

-- ========================================
-- 📝 NOTES
-- ========================================
-- 
-- การเปลี่ยนแปลง:
-- 1. ✅ แทนที่ auth.uid() → (select auth.uid()) ในทุก policy
-- 2. ✅ แทนที่ auth.role() → (select auth.role()) ในทุก policy  
-- 3. ✅ ลบ duplicate indexes
--
-- ผลลัพธ์ที่คาดหวัง:
-- - Query performance เร็วขึ้น 50-80%
-- - Dashboard timeout ลดลงอย่างมาก
-- - RLS evaluation เร็วขึ้น
--
-- ถ้ามี policies ที่ fix ไม่ได้ (Skipped):
-- - ตรวจสอบ error message ใน output
-- - อาจต้อง fix manually
--
-- ========================================
