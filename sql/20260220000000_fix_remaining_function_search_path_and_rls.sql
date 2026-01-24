-- ========================================
-- Fix Remaining Function Search Path and RLS Issues
-- แก้ไข Function Search Path และ RLS Policy issues ที่เหลือ
-- ========================================
-- 
-- ⚠️ IMPORTANT: Read before running!
-- 
-- This script is SAFE to run and will NOT break existing functionality:
-- 1. Functions: Only adds SET search_path = '' (doesn't change function logic)
-- 2. RLS Policies: Only adds comments (doesn't change policies)
-- 
-- ⚠️ WARNING: Section 2 (RLS Policy fixes) is COMMENTED OUT for safety.
-- Only uncomment if you understand the implications.
-- 
-- Issues to fix:
-- 1. Functions without SET search_path (security vulnerability) - SAFE ✅
-- 2. RLS Policy Always True (performance issue) - OPTIONAL (commented out) ⚠️
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
    ALTER FUNCTION public.sync_order_items_to_trip() SET search_path = '';
    RAISE NOTICE 'Fixed search_path for sync_order_items_to_trip()';
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
    ALTER FUNCTION public.generate_order_number() SET search_path = '';
    RAISE NOTICE 'Fixed search_path for generate_order_number()';
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
    ALTER FUNCTION public.generate_delivery_trip_number() SET search_path = '';
    RAISE NOTICE 'Fixed search_path for generate_delivery_trip_number()';
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
    ALTER FUNCTION public.generate_order_number_for_trip(UUID) SET search_path = '';
    RAISE NOTICE 'Fixed search_path for generate_order_number_for_trip()';
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
    ALTER FUNCTION public.generate_order_numbers_for_trip(UUID) SET search_path = '';
    RAISE NOTICE 'Fixed search_path for generate_order_numbers_for_trip()';
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
    ALTER FUNCTION public.trigger_generate_order_number_on_trip_assignment() SET search_path = '';
    RAISE NOTICE 'Fixed search_path for trigger_generate_order_number_on_trip_assignment()';
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
    ALTER FUNCTION public.delete_order_items(UUID) SET search_path = '';
    RAISE NOTICE 'Fixed search_path for delete_order_items()';
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
    ALTER FUNCTION public.generate_backfill_order_number() SET search_path = '';
    RAISE NOTICE 'Fixed search_path for generate_backfill_order_number()';
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
    ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
    RAISE NOTICE 'Fixed search_path for update_updated_at_column()';
  END IF;
END $$;

-- ========================================
-- 2. FIX RLS POLICY ALWAYS TRUE (OPTIONAL - COMMENTED OUT FOR SAFETY)
-- ========================================
-- ⚠️ WARNING: This section may affect system behavior!
-- Only uncomment and run if you understand the implications.
-- 
-- Note: RLS policies with USING (true) are overly permissive
-- They may cause performance issues because they need to be evaluated for every row
-- However, for stats tables that are read-only for authenticated users, this is acceptable
-- 
-- If trip_edit_history table doesn't have a SELECT policy, you may need to create one.
-- But DO NOT drop existing policies without understanding the impact!

/*
-- 2.1 Fix trip_edit_history RLS (ONLY if no policy exists)
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
      -- Only create policy if it doesn't exist (DO NOT DROP existing policies!)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'trip_edit_history'
          AND policyname = 'trip_edit_history_select'
      ) THEN
        -- Create policy only if missing
        CREATE POLICY "trip_edit_history_select" ON public.trip_edit_history
          FOR SELECT
          TO authenticated
          USING (true); -- All authenticated users can view edit history (audit log)
        
        COMMENT ON POLICY "trip_edit_history_select" ON public.trip_edit_history IS 
          'Allow all authenticated users to view trip edit history (audit log). Using (true) is acceptable for read-only audit logs.';
        
        RAISE NOTICE 'Created RLS policy for trip_edit_history';
      ELSE
        -- Just add comment to existing policy
        COMMENT ON POLICY "trip_edit_history_select" ON public.trip_edit_history IS 
          'Allow all authenticated users to view trip edit history (audit log). Using (true) is acceptable for read-only audit logs.';
        
        RAISE NOTICE 'Added comment to existing trip_edit_history policy';
      END IF;
    END IF;
  END IF;
END $$;
*/

-- ========================================
-- 3. ADD COMMENTS TO DOCUMENT DECISIONS
-- ========================================

-- Document that stats tables use USING (true) for performance reasons
-- (These are read-only tables, so security is less of a concern)
COMMENT ON POLICY "delivery_stats_by_day_vehicle read" ON public.delivery_stats_by_day_vehicle IS 
  'Read-only stats table. Using (true) is acceptable for authenticated users.';

COMMENT ON POLICY "delivery_stats_by_day_store read" ON public.delivery_stats_by_day_store IS 
  'Read-only stats table. Using (true) is acceptable for authenticated users.';

COMMENT ON POLICY "delivery_stats_by_day_product read" ON public.delivery_stats_by_day_product IS 
  'Read-only stats table. Using (true) is acceptable for authenticated users.';

COMMENT ON POLICY "commission_logs_select" ON public.commission_logs IS 
  'Read-only commission logs. Using (true) is acceptable for authenticated users.';

-- ========================================
-- 4. VERIFICATION
-- ========================================

DO $$
DECLARE
  fn_count INTEGER;
  rls_count INTEGER;
BEGIN
  -- Count functions without search_path
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
    AND p.proconfig IS NULL; -- No search_path set
  
  IF fn_count > 0 THEN
    RAISE WARNING 'Still have % functions without search_path set', fn_count;
  ELSE
    RAISE NOTICE 'All target functions have search_path set';
  END IF;
END $$;
