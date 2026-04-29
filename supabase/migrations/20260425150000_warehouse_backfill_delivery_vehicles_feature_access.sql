-- ค่า role_feature_access สำหรับ warehouse: อัปเกรดจาก none/view เป็นระดับที่ใช้งาน RLS/เมทริกซ์สอดคล้อง
-- (กรณี migration อื่นใช้ DO NOTHING จนยังค้าง 'none' หรือตั้ง 'view' ทำให้แก้ทริป/รถไม่ได้)

BEGIN;

INSERT INTO public.role_feature_access (role, feature_key, access_level) VALUES
  ('warehouse', 'tab.delivery_trips', 'manage'::public.feature_access_level),
  ('warehouse', 'tab.vehicles', 'edit'::public.feature_access_level)
ON CONFLICT (role, feature_key) DO UPDATE
SET access_level = CASE
  WHEN public.role_feature_access.feature_key = 'tab.delivery_trips'
    AND public.role_feature_access.access_level IN (
      'none'::public.feature_access_level,
      'view'::public.feature_access_level,
      'edit'::public.feature_access_level
    )
    THEN 'manage'::public.feature_access_level
  WHEN public.role_feature_access.feature_key = 'tab.vehicles'
    AND public.role_feature_access.access_level IN (
      'none'::public.feature_access_level,
      'view'::public.feature_access_level
    )
    THEN 'edit'::public.feature_access_level
  ELSE public.role_feature_access.access_level
END;

COMMIT;
