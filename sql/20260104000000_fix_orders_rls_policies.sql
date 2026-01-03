-- ========================================
-- Fix RLS Policies for Orders Management System
-- ========================================

-- ========================================
-- 1. Order Status History: เพิ่ม policy สำหรับ INSERT/UPDATE
-- ========================================

-- Staff+ สามารถเพิ่มประวัติสถานะได้
DROP POLICY IF EXISTS "Staff can insert order status history" ON public.order_status_history;
CREATE POLICY "Staff can insert order status history" 
  ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'user'))
  );

-- Admin สามารถแก้ไขประวัติสถานะได้ (กรณีพิเศษ)
DROP POLICY IF EXISTS "Admin can update order status history" ON public.order_status_history;
CREATE POLICY "Admin can update order status history" 
  ON public.order_status_history FOR UPDATE TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

-- ========================================
-- 2. Orders: ปรับ policy ให้ Staff+ update ได้
-- ========================================

-- ลบ policy เดิม
DROP POLICY IF EXISTS "Owner and admin can update orders" ON public.orders;

-- สร้าง policy ใหม่: Staff+ สามารถ update ได้
CREATE POLICY "Staff can update orders" 
  ON public.orders FOR UPDATE TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'user'))
  );

-- ========================================
-- Comments
-- ========================================
COMMENT ON POLICY "Staff can insert order status history" ON public.order_status_history 
  IS 'Staff+ สามารถเพิ่มประวัติการเปลี่ยนสถานะออเดอร์ได้';
  
COMMENT ON POLICY "Staff can update orders" ON public.orders 
  IS 'Staff+ สามารถแก้ไขออเดอร์ได้ (สำหรับการจัดทริป, เปลี่ยนสถานะ ฯลฯ)';

