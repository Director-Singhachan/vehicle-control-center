-- ========================================
-- Fix Function Search Path Only (SAFE VERSION)
-- แก้ไข Function Search Path เท่านั้น (ปลอดภัย 100%)
-- ========================================
-- 
-- ✅ SAFE TO RUN: This script only adds SET search_path = '' to functions
-- It does NOT change function logic, parameters, or behavior
-- It does NOT modify RLS policies or table structures
-- 
-- What it does:
-- - Adds SET search_path = '' to functions that don't have it
-- - This prevents search_path injection attacks (security fix)
-- - Functions will work exactly the same as before
-- 
-- ⚠️ BACKUP RECOMMENDED: Always backup your database before running migrations
-- ========================================

-- ========================================
-- 1. FIX FUNCTIONS WITHOUT SET search_path
-- ========================================

-- 1.1 Fix sync_order_items_to_trip()
DO $$
BEGIN
  -- Check if function exists and fix it
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sync_order_items_to_trip'
  ) THEN
    BEGIN
      ALTER FUNCTION public.sync_order_items_to_trip() SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for sync_order_items_to_trip()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix sync_order_items_to_trip(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ sync_order_items_to_trip() does not exist, skipping';
  END IF;
END $$;

-- 1.2 Fix generate_order_number() (if not already fixed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_order_number'
  ) THEN
    BEGIN
      ALTER FUNCTION public.generate_order_number() SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for generate_order_number()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix generate_order_number(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ generate_order_number() does not exist, skipping';
  END IF;
END $$;

-- 1.3 Fix generate_delivery_trip_number() (if not already fixed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_delivery_trip_number'
  ) THEN
    BEGIN
      ALTER FUNCTION public.generate_delivery_trip_number() SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for generate_delivery_trip_number()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix generate_delivery_trip_number(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ generate_delivery_trip_number() does not exist, skipping';
  END IF;
END $$;

-- 1.4 Fix generate_order_number_for_trip()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_order_number_for_trip'
  ) THEN
    BEGIN
      ALTER FUNCTION public.generate_order_number_for_trip(UUID) SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for generate_order_number_for_trip()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix generate_order_number_for_trip(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ generate_order_number_for_trip() does not exist, skipping';
  END IF;
END $$;

-- 1.5 Fix generate_order_numbers_for_trip()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_order_numbers_for_trip'
  ) THEN
    BEGIN
      ALTER FUNCTION public.generate_order_numbers_for_trip(UUID) SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for generate_order_numbers_for_trip()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix generate_order_numbers_for_trip(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ generate_order_numbers_for_trip() does not exist, skipping';
  END IF;
END $$;

-- 1.6 Fix trigger_generate_order_number_on_trip_assignment()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'trigger_generate_order_number_on_trip_assignment'
  ) THEN
    BEGIN
      ALTER FUNCTION public.trigger_generate_order_number_on_trip_assignment() SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for trigger_generate_order_number_on_trip_assignment()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix trigger_generate_order_number_on_trip_assignment(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ trigger_generate_order_number_on_trip_assignment() does not exist, skipping';
  END IF;
END $$;

-- 1.7 Fix delete_order_items()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'delete_order_items'
  ) THEN
    BEGIN
      ALTER FUNCTION public.delete_order_items(UUID) SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for delete_order_items()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix delete_order_items(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ delete_order_items() does not exist, skipping';
  END IF;
END $$;

-- 1.8 Fix generate_backfill_order_number()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_backfill_order_number'
  ) THEN
    BEGIN
      ALTER FUNCTION public.generate_backfill_order_number() SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for generate_backfill_order_number()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix generate_backfill_order_number(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ generate_backfill_order_number() does not exist, skipping';
  END IF;
END $$;

-- 1.9 Fix update_updated_at_column() (generic trigger function)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    BEGIN
      ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
      RAISE NOTICE '✅ Fixed search_path for update_updated_at_column()';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Failed to fix update_updated_at_column(): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ update_updated_at_column() does not exist, skipping';
  END IF;
END $$;

-- ========================================
-- 2. VERIFICATION
-- ========================================

DO $$
DECLARE
  fn_count INTEGER;
  fixed_count INTEGER;
BEGIN
  -- Count functions that should have search_path but don't
  SELECT COUNT(*) INTO fn_count
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
    AND (p.proconfig IS NULL OR NOT ('search_path' = ANY(p.proconfig)));
  
  -- Count functions that now have search_path set
  SELECT COUNT(*) INTO fixed_count
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
    AND 'search_path' = ANY(p.proconfig);
  
  IF fn_count > 0 THEN
    RAISE WARNING '⚠️ Still have % functions without search_path set', fn_count;
  END IF;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE '✅ Successfully fixed % functions with search_path', fixed_count;
  END IF;
  
  RAISE NOTICE '📊 Summary: % fixed, % remaining', fixed_count, fn_count;
END $$;
