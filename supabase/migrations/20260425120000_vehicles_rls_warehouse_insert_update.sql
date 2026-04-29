-- ให้ role warehouse สร้าง/แก้ไข master ยานพาหนะได้ (ทะเบียน ฯลฯ) สอดคล้องงานคลัง/ขนส่ง
-- คงการลบรถเฉพาะ admin, manager ผ่าน policy เดิม "vehicles write manager" (FOR ALL รวม DELETE)
--
-- หมายเหตุ: แอปฝั่ง feature matrix ต้องมี tab.vehicles ระดับ edit+ (ดู featureAccess BUILT_IN / role_feature_access)

BEGIN;

-- เพิ่มทรัพยากร: warehouse ยังทำ SELECT ตาม "vehicles read all" อยู่แล้ว

DROP POLICY IF EXISTS "vehicles insert warehouse" ON public.vehicles;
CREATE POLICY "vehicles insert warehouse"
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "vehicles update warehouse" ON public.vehicles;
CREATE POLICY "vehicles update warehouse"
  ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'warehouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'warehouse'
    )
  );

-- ถ้า role warehouse ใช้ matrix จาก DB แบบ strict แต่ยังไม่มีแถว tab.vehicles จะได้ none — เติมแถวเริ่มต้น (ไม่ทับถ้ามีแล้ว)
INSERT INTO public.role_feature_access (role, feature_key, access_level) VALUES
  ('warehouse', 'tab.vehicles', 'edit'::public.feature_access_level)
ON CONFLICT (role, feature_key) DO NOTHING;

COMMIT;
