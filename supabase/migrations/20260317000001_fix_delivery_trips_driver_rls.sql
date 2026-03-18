-- Migration: Fix RLS for delivery_trips and related tables
-- ปัญหา: Driver ไม่สามารถดูทริปที่จัดไว้ให้รถที่ตัวเองจะขับได้
--        เพราะ policy เดิมต้องการ driver_id = auth.uid() เท่านั้น
--        แต่ถ้าทริปยังไม่ได้ assign driver_id ไว้ หรือ assign แล้วแต่ไม่ตรง UUID
--        driver จะมองไม่เห็นทริปและไม่สามารถผูกการใช้รถได้
--
-- แก้: เปิดให้ authenticated user ทุกคนที่มี profile ที่ valid (ไม่ถูก soft-delete)
--      สามารถ SELECT delivery_trips ได้ (สอดคล้องกับ sql/20260128000004)
--      โดยเพิ่ม deleted_at IS NULL เพื่อรองรับ soft-delete migration

BEGIN;

-- ── delivery_trips ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "delivery_trips_select" ON public.delivery_trips;

CREATE POLICY "delivery_trips_select"
ON public.delivery_trips
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.role IN (
        'admin', 'manager', 'inspector', 'user',
        'driver', 'executive', 'sales',
        'service_staff', 'hr', 'accounting', 'warehouse'
      )
  )
  OR driver_id = auth.uid()
);

-- ── delivery_trip_stores ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "delivery_trip_stores_select" ON public.delivery_trip_stores;

CREATE POLICY "delivery_trip_stores_select"
ON public.delivery_trip_stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.role IN (
        'admin', 'manager', 'inspector', 'user',
        'driver', 'executive', 'sales',
        'service_staff', 'hr', 'accounting', 'warehouse'
      )
  )
);

-- ── delivery_trip_items ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "delivery_trip_items_select" ON public.delivery_trip_items;

CREATE POLICY "delivery_trip_items_select"
ON public.delivery_trip_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.role IN (
        'admin', 'manager', 'inspector', 'user',
        'driver', 'executive', 'sales',
        'service_staff', 'hr', 'accounting', 'warehouse'
      )
  )
);

-- ── stores ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stores_select" ON public.stores;

CREATE POLICY "stores_select"
ON public.stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.role IN (
        'admin', 'manager', 'inspector', 'user',
        'driver', 'executive', 'sales',
        'service_staff', 'hr', 'accounting', 'warehouse'
      )
  )
);

COMMIT;
