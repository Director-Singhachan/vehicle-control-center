-- ========================================
-- Debug: Check all RLS policies with USING (true)
-- ตรวจสอบ policies ทั้งหมดที่ใช้ USING (true)
-- ========================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename IN ('inventory_transactions', 'tickets', 'vehicle_alerts')
ORDER BY tablename, policyname;

-- ========================================
-- This will show all policies for these three tables
-- Look for policies where using_expression = 'true'
-- ========================================
