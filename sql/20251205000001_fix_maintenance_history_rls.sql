-- ========================================
-- Fix Maintenance History RLS Policy
-- แก้ไข RLS policy สำหรับ maintenance_history เพื่อให้ inspector/manager/admin สามารถ insert ได้
-- ========================================

-- Drop existing policy
DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance history" ON public.maintenance_history;

-- Create new policy that allows:
-- 1. Users can insert if created_by = auth.uid() (original behavior)
-- 2. Inspector/Manager/Admin can insert regardless of created_by (for completing repairs)
CREATE POLICY "Allow authenticated users to insert maintenance history" 
  ON public.maintenance_history 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if created_by matches current user
    created_by = auth.uid()
    OR
    -- Allow if user is inspector, manager, or admin
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('inspector', 'manager', 'admin')
    )
  );

