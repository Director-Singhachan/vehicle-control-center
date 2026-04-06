-- ฟีเจอร์ใหม่: รายงานผู้บริหาร (report.pnl_executive) — backfill admin/hr ให้สอดคล้อง seed เดิม
INSERT INTO public.role_feature_access (role, feature_key, access_level)
SELECT r.role, 'report.pnl_executive', 'manage'::public.feature_access_level
FROM (VALUES ('admin'::public.app_role), ('hr'::public.app_role)) AS r(role)
ON CONFLICT (role, feature_key) DO NOTHING;
