-- ========================================
-- Fix Sales Role Access to Warehouses, Orders Delete, and Delivery Trips
-- Migration: 20260208000000_fix_sales_warehouses_and_orders_access.sql
-- ========================================
-- แก้ไข RLS policies เพื่อให้ฝ่ายขายสามารถ:
-- 1. ดู warehouses (สาขา/คลังสินค้า) ได้
-- 2. ลบออเดอร์ได้
-- 3. ดู delivery_trips, delivery_trip_stores, delivery_trip_items ได้ (สำหรับหน้า "ออกใบแจ้งหนี้")
-- 4. อัปเดต invoice_status ใน delivery_trip_stores ได้
-- ========================================

BEGIN;

-- ========================================
-- 1. Fix Warehouses SELECT Policy
-- ========================================
-- ปัจจุบัน warehouses ใช้ "Admin can manage warehouses" FOR ALL
-- ซึ่งจำกัด SELECT เฉพาะ admin และ manager
-- ต้องเพิ่ม SELECT policy แยกที่รวม sales

-- ลบ policy เดิม (ถ้ามี) ที่ใช้ FOR ALL
DROP POLICY IF EXISTS "Admin can manage warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_delete" ON public.warehouses;

-- สร้าง SELECT policy ใหม่ที่รวม sales
CREATE POLICY "warehouses_select" ON public.warehouses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales', 'inspector', 'user', 'driver', 'executive')
    )
  );

-- สร้าง INSERT/UPDATE/DELETE policy สำหรับ admin และ manager เท่านั้น
CREATE POLICY "warehouses_insert" ON public.warehouses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "warehouses_update" ON public.warehouses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "warehouses_delete" ON public.warehouses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================
-- 2. Fix Orders DELETE Policy
-- ========================================
-- เพิ่ม sales เข้าไปใน orders_delete policy

DROP POLICY IF EXISTS "orders_delete" ON public.orders;

CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales')
    )
  );

-- Comment
COMMENT ON POLICY "warehouses_select" ON public.warehouses IS 
  'อนุญาตให้ authenticated users ทุก role (รวม sales) ดู warehouses ได้';

COMMENT ON POLICY "orders_delete" ON public.orders IS 
  'อนุญาตให้ Admin, Manager และ Sales ลบออเดอร์ได้';

-- ========================================
-- 3. Fix Delivery Trips SELECT Policy
-- ========================================
-- เพิ่ม sales เข้าไปใน delivery_trips SELECT policy

DROP POLICY IF EXISTS "delivery_trips_select" ON public.delivery_trips;

CREATE POLICY "delivery_trips_select"
ON public.delivery_trips
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales')
  )
  OR driver_id = auth.uid()
);

-- ========================================
-- 4. Fix Delivery Trip Stores SELECT and UPDATE Policies
-- ========================================
-- เพิ่ม sales เข้าไปใน delivery_trip_stores SELECT และ UPDATE policies
-- (UPDATE จำเป็นสำหรับการอัปเดต invoice_status)

DROP POLICY IF EXISTS "delivery_trip_stores_select" ON public.delivery_trip_stores;

CREATE POLICY "delivery_trip_stores_select"
ON public.delivery_trip_stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales')
  )
);

-- อัปเดต UPDATE policy เพื่อให้ sales อัปเดต invoice_status ได้
DROP POLICY IF EXISTS "delivery_trip_stores_update" ON public.delivery_trip_stores;

CREATE POLICY "delivery_trip_stores_update"
ON public.delivery_trip_stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'sales')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'sales')
  )
);

-- ========================================
-- 5. Fix Delivery Trip Items SELECT Policy
-- ========================================
-- เพิ่ม sales เข้าไปใน delivery_trip_items SELECT policy

DROP POLICY IF EXISTS "delivery_trip_items_select" ON public.delivery_trip_items;

CREATE POLICY "delivery_trip_items_select"
ON public.delivery_trip_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'user', 'driver', 'executive', 'sales')
  )
);

-- Comments
COMMENT ON POLICY "delivery_trips_select" ON public.delivery_trips IS 
  'อนุญาตให้ authenticated users ทุก role (รวม sales) ดู delivery_trips ได้';

COMMENT ON POLICY "delivery_trip_stores_select" ON public.delivery_trip_stores IS 
  'อนุญาตให้ authenticated users ทุก role (รวม sales) ดู delivery_trip_stores ได้';

COMMENT ON POLICY "delivery_trip_stores_update" ON public.delivery_trip_stores IS 
  'อนุญาตให้ Admin, Manager, Inspector และ Sales อัปเดต delivery_trip_stores ได้ (สำหรับการอัปเดต invoice_status)';

COMMENT ON POLICY "delivery_trip_items_select" ON public.delivery_trip_items IS 
  'อนุญาตให้ authenticated users ทุก role (รวม sales) ดู delivery_trip_items ได้';

COMMIT;

-- ========================================
-- ตรวจสอบ policies
-- ========================================
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual
-- FROM pg_policies
-- WHERE tablename IN ('warehouses', 'orders', 'delivery_trips', 'delivery_trip_stores', 'delivery_trip_items')
-- ORDER BY tablename, policyname;
