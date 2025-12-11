-- ========================================
-- Fix remaining Function Search Path warnings
-- ========================================
-- Targets (any signature):
--  - public.update_commission_rates_updated_at
--  - public.update_delivery_trip_crews_updated_at
--  - public.run_daily_summary_refresh
-- Approach: dynamically ALTER all overloads to set search_path = ''
-- ========================================

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_commission_rates_updated_at',
        'update_delivery_trip_crews_updated_at',
        'run_daily_summary_refresh'
      )
  LOOP
    RAISE NOTICE 'Setting search_path to empty for %', fn.regproc;
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = '''';',
      fn.regproc
    );
  END LOOP;
END;
$$;

-- NOTE: Leaked Password Protection warning must be enabled in Supabase Dashboard:
-- Authentication → Settings → toggle "Leaked Password Protection"


