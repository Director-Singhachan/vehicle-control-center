-- คลัง (warehouse): มองเห็นทริปส่งสินค้าและความเกี่ยวข้องได้ครบ
-- สาเหตุ: SELECT policy เดิมใช้ EXISTS (SELECT … FROM public.profiles …) ภายใน RLS เดียวกับ
-- profiles — ใน environment บางตัว subquery อ่าน role จาก profiles ผิดพลาดได้ (คล้าย 60425200000)
-- แก้: ใช้ฟังก์ชัน SECURITY DEFINER และเปิดให้ warehouse อ่าน profiles ของพนักงานอื่น
--      (ชื่อคนขับ / ผู้ช่วยบนการ์ดทริป — เดิมโหลด .in('id', driverIds) แล้วได้ แถวว่าง)

BEGIN;

CREATE OR REPLACE FUNCTION public.has_active_role(user_id uuid, required_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  user_role text;
  deleted_ts timestamptz;
BEGIN
  SELECT p.role, p.deleted_at INTO user_role, deleted_ts
  FROM public.profiles p
  WHERE p.id = user_id;

  IF user_role IS NULL OR deleted_ts IS NOT NULL THEN
    RETURN false;
  END IF;

  RETURN user_role = ANY (required_roles);
END;
$$;

REVOKE ALL ON FUNCTION public.has_active_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_role(uuid, text[]) TO authenticated;

-- Role ชุดเดียวกับ 20260317000001_fix_delivery_trips_driver_rls (+ dev สำหรับบัญชี dev)
-- delivery_trips
DROP POLICY IF EXISTS "delivery_trips_select" ON public.delivery_trips;

CREATE POLICY "delivery_trips_select"
ON public.delivery_trips
FOR SELECT
TO authenticated
USING (
  public.has_active_role(
    (select auth.uid()),
    ARRAY[
      'admin', 'manager', 'inspector', 'user',
      'driver', 'executive', 'sales',
      'service_staff', 'hr', 'accounting', 'warehouse',
      'dev'
    ]
  )
  OR driver_id = (select auth.uid())
);

-- delivery_trip_stores
DROP POLICY IF EXISTS "delivery_trip_stores_select" ON public.delivery_trip_stores;

CREATE POLICY "delivery_trip_stores_select"
ON public.delivery_trip_stores
FOR SELECT
TO authenticated
USING (
  public.has_active_role(
    (select auth.uid()),
    ARRAY[
      'admin', 'manager', 'inspector', 'user',
      'driver', 'executive', 'sales',
      'service_staff', 'hr', 'accounting', 'warehouse',
      'dev'
    ]
  )
);

-- delivery_trip_items
DROP POLICY IF EXISTS "delivery_trip_items_select" ON public.delivery_trip_items;

CREATE POLICY "delivery_trip_items_select"
ON public.delivery_trip_items
FOR SELECT
TO authenticated
USING (
  public.has_active_role(
    (select auth.uid()),
    ARRAY[
      'admin', 'manager', 'inspector', 'user',
      'driver', 'executive', 'sales',
      'service_staff', 'hr', 'accounting', 'warehouse',
      'dev'
    ]
  )
);

-- stores
DROP POLICY IF EXISTS "stores_select" ON public.stores;

CREATE POLICY "stores_select"
ON public.stores
FOR SELECT
TO authenticated
USING (
  public.has_active_role(
    (select auth.uid()),
    ARRAY[
      'admin', 'manager', 'inspector', 'user',
      'driver', 'executive', 'sales',
      'service_staff', 'hr', 'accounting', 'warehouse',
      'dev'
    ]
  )
);

-- products (เดิม 20260327000001_products_select_logistics_roles — เหตุผลเดียวกัน)
DROP POLICY IF EXISTS "products_select" ON public.products;

CREATE POLICY "products_select"
ON public.products
FOR SELECT
TO authenticated
USING (
  public.has_active_role(
    (select auth.uid()),
    ARRAY[
      'admin', 'manager', 'inspector', 'user',
      'driver', 'executive', 'sales',
      'warehouse', 'accounting', 'service_staff', 'hr',
      'dev'
    ]
  )
);

COMMENT ON POLICY "products_select" ON public.products IS
  'ดูรายการสินค้าได้สำหรับโลจิสติกส์และบทบาทเกี่ยวข้อง — ใช้ has_active_role (หลบ RLS recursion บน profiles)';

-- Warehouse โหลดชื่อพนักงานอื่น (คนขับ, crew, แก้ไขประวัติ) เหมือนฝ่ายควบคุม
DROP POLICY IF EXISTS "profiles_warehouse_org_read" ON public.profiles;

CREATE POLICY "profiles_warehouse_org_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role((select auth.uid()), ARRAY['warehouse'])
);

COMMENT ON POLICY "profiles_warehouse_org_read" ON public.profiles IS
  'ให้คลังอ่าน profiles ในองค์กรได้ — จำเป็นต่อการแสดงคนขับ/ลูกเรือบนหน้าทริปจัดส่ง';

COMMIT;
