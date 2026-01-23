-- ========================================
-- Fix Remaining Function Overloads (All Signatures)
-- แก้ไข Function Search Path สำหรับทุก overload ที่เหลือ
-- ========================================
-- 
-- ⚠️ PROBLEM: Some functions have multiple overloads (different signatures)
-- The previous script may have only fixed one signature, leaving others
-- 
-- ✅ SOLUTION: This script fixes ALL overloads of the remaining functions
-- ========================================

-- ========================================
-- 1. FIX delete_order_items (ALL OVERLOADS)
-- ========================================
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'delete_order_items'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- ========================================
-- 2. FIX generate_backfill_order_number (ALL OVERLOADS)
-- ========================================
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_backfill_order_number'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- ========================================
-- 3. FIX generate_order_number_for_trip (ALL OVERLOADS)
-- ========================================
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_order_number_for_trip'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- ========================================
-- 4. FIX ALL REMAINING FUNCTIONS (CATCH-ALL)
-- ========================================
-- Fix any other functions from the list that might have been missed

-- 4.1 Fix sync_order_items_to_trip (ALL OVERLOADS)
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_order_items_to_trip'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4.2 Fix generate_order_number (ALL OVERLOADS)
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_order_number'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4.3 Fix generate_delivery_trip_number (ALL OVERLOADS)
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_delivery_trip_number'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4.4 Fix generate_order_numbers_for_trip (ALL OVERLOADS)
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_order_numbers_for_trip'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4.5 Fix trigger_generate_order_number_on_trip_assignment (ALL OVERLOADS)
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'trigger_generate_order_number_on_trip_assignment'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4.6 Fix update_updated_at_column (ALL OVERLOADS)
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_record.regproc);
      RAISE NOTICE '✅ Fixed search_path for %', fn_record.regproc;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix %: %', fn_record.regproc, SQLERRM;
    END;
  END LOOP;
END $$;

-- ========================================
-- 5. VERIFICATION - Show remaining issues
-- ========================================
DO $$
DECLARE
  fn_record RECORD;
  total_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Checking remaining functions without search_path...';
  RAISE NOTICE '========================================';
  
  FOR fn_record IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'sync_order_items_to_trip',
        'generate_order_number',
        'generate_delivery_trip_number',
        'generate_order_number_for_trip',
        'generate_order_numbers_for_trip',
        'trigger_generate_order_number_on_trip_assignment',
        'delete_order_items',
        'generate_backfill_order_number',
        'update_updated_at_column'
      )
      AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)))
    ORDER BY p.proname
  LOOP
    RAISE WARNING '⚠️ Still missing search_path: %', fn_record.regproc;
    total_count := total_count + 1;
  END LOOP;
  
  IF total_count = 0 THEN
    RAISE NOTICE '✅ All target functions have search_path set!';
  ELSE
    RAISE WARNING '⚠️ Total: % functions still need fixing', total_count;
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
