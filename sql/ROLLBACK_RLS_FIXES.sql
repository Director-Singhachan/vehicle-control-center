-- ========================================
-- ROLLBACK: ย้อนกลับการแก้ไข RLS Policies
-- ใช้เมื่อมีปัญหาหลังจากรัน fix scripts
-- ========================================
-- 
-- ⚠️ WARNING: 
-- Script นี้จะลบ policies ที่แก้ไขไป
-- ต้อง restore จาก backup เพื่อให้ policies กลับมาเหมือนเดิม
-- 
-- หรือใช้ script นี้เพื่อลบ policies ที่มีปัญหา
-- แล้วสร้างใหม่จาก backup
-- ========================================

-- ========================================
-- PART 1: DROP FIXED POLICIES
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rolling back RLS policy fixes...';
  RAISE NOTICE '========================================';
  
  -- Drop vehicles policies
  DROP POLICY IF EXISTS "vehicles read all" ON public.vehicles;
  DROP POLICY IF EXISTS "vehicles write manager" ON public.vehicles;
  RAISE NOTICE '✅ Dropped vehicles policies';
  
  -- Drop trip_logs policies
  DROP POLICY IF EXISTS "Users can view all trips" ON public.trip_logs;
  DROP POLICY IF EXISTS "Drivers can update own trips" ON public.trip_logs;
  DROP POLICY IF EXISTS "Drivers can create trips" ON public.trip_logs;
  RAISE NOTICE '✅ Dropped trip_logs policies';
  
  -- Drop trip_edit_history policies
  DROP POLICY IF EXISTS "trip_edit_history_insert" ON public.trip_edit_history;
  DROP POLICY IF EXISTS "trip_edit_history update admin only" ON public.trip_edit_history;
  DROP POLICY IF EXISTS "trip_edit_history delete admin only" ON public.trip_edit_history;
  RAISE NOTICE '✅ Dropped trip_edit_history policies';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Rollback completed';
  RAISE NOTICE '⚠️ IMPORTANT: Restore from backup to restore original policies';
  RAISE NOTICE '========================================';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '❌ Error during rollback: %', SQLERRM;
END $$;
