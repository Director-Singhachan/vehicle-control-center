-- ========================================
-- Fix Orders Delete RLS Policy
-- Migration: 20260205000000_fix_orders_delete_rls.sql
-- ========================================
-- แก้ไข RLS policy สำหรับการลบออเดอร์
-- ให้ Admin และ Manager สามารถลบออเดอร์ได้
-- ========================================

-- ลบ policy เดิม (ถ้ามี)
DROP POLICY IF EXISTS "orders_delete" ON public.orders;

-- สร้าง policy ใหม่ที่ชัดเจนขึ้น
CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    -- Admin และ Manager สามารถลบได้
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Comment
COMMENT ON POLICY "orders_delete" ON public.orders IS 
  'อนุญาตให้ Admin และ Manager ลบออเดอร์ได้';

-- ========================================
-- ตรวจสอบ policy
-- ========================================
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename = 'orders' AND policyname = 'orders_delete';
