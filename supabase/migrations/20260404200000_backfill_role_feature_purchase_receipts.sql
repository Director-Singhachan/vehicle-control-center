-- Backfill tab.purchase_receipts ให้ทุก role ที่ใช้ matrix แบบ strict ไม่ถูกมองเป็น none เมื่อยังไม่มีแถว
-- (แอปมี FEATURE_MATRIX_SURVIVAL_KEYS fallback แล้ว — แถวนี้ช่วยให้หน้า Settings เห็นค่าชัดและ sync กับความตั้งใจ)

INSERT INTO public.role_feature_access (role, feature_key, access_level) VALUES
  ('user', 'tab.purchase_receipts', 'none'::public.feature_access_level),
  ('driver', 'tab.purchase_receipts', 'none'::public.feature_access_level),
  ('sales', 'tab.purchase_receipts', 'none'::public.feature_access_level),
  ('service_staff', 'tab.purchase_receipts', 'none'::public.feature_access_level),
  ('inspector', 'tab.purchase_receipts', 'none'::public.feature_access_level),
  ('manager', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('executive', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('admin', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('hr', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('accounting', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('warehouse', 'tab.purchase_receipts', 'manage'::public.feature_access_level)
ON CONFLICT (role, feature_key) DO NOTHING;
