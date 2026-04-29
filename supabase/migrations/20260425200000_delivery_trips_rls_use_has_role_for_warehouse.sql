-- แก้: บทบาท warehouse อัปเดต delivery_trips ไม่กระทบแถว (0 rows) แม้ UI กดบันทึก
-- สาเหตุที่เป็นไปได้: policy เดิมใช้ EXISTS (SELECT … FROM public.profiles …) ถูก RLS บน
-- public.profiles รบกวน subquery ทำให้ role อ่านไม่ออก → EXISTS = false
-- แก้: ใช้ public.has_role(…) แบบ SECURITY DEFINER อ่าน role ตรงจาก profiles (คล้าย trip_logs / migration 25160000)

BEGIN;

-- รับรองมีฟังก์ชัน (บางโปรเจกต์มีจาก sql/ มือ — รวมไว้ใน supabase ให้ apply สม่ำเสมอ)
-- หมายเหตุ: ชื่อพารามิเตอร์ตัวที่สองต้องเป็น required_roles ให้ตรงของเดิม — PG ห้าม REPLACE แล้วเปลี่ยนชื่อพารามิเตอร์
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, required_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT p.role INTO user_role
  FROM public.profiles p
  WHERE p.id = user_id;
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  RETURN user_role = ANY (required_roles);
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text[]) TO authenticated;

-- ── delivery_trips: สร้าง / อัปเดต รวม warehouse (รวมเปลี่ยน vehicle_id + branch ตามรถ) ──
DROP POLICY IF EXISTS "delivery_trips_insert" ON public.delivery_trips;
CREATE POLICY "delivery_trips_insert"
ON public.delivery_trips
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((select auth.uid()), ARRAY['admin', 'manager', 'inspector', 'warehouse'])
);

DROP POLICY IF EXISTS "delivery_trips_update" ON public.delivery_trips;
CREATE POLICY "delivery_trips_update"
ON public.delivery_trips
FOR UPDATE
TO authenticated
USING (
  public.has_role((select auth.uid()), ARRAY['admin', 'manager', 'inspector', 'warehouse'])
  OR driver_id = (select auth.uid())
)
WITH CHECK (
  public.has_role((select auth.uid()), ARRAY['admin', 'manager', 'inspector', 'warehouse'])
  OR driver_id = (select auth.uid())
);

COMMIT;
