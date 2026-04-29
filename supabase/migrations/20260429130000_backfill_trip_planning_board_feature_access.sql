-- Backfill tab.trip_planning_board ใน role_feature_access (ให้คลัง/สายตรจดไม่ติด strict none)
BEGIN;

INSERT INTO public.role_feature_access (role, feature_key, access_level) VALUES
  ('warehouse', 'tab.trip_planning_board', 'manage'::public.feature_access_level),
  ('inspector', 'tab.trip_planning_board', 'view'::public.feature_access_level)
ON CONFLICT (role, feature_key) DO UPDATE
SET access_level = CASE
  WHEN public.role_feature_access.role = 'warehouse'
    AND public.role_feature_access.access_level IN (
      'none'::public.feature_access_level,
      'view'::public.feature_access_level,
      'edit'::public.feature_access_level
    )
    THEN 'manage'::public.feature_access_level
  WHEN public.role_feature_access.role = 'inspector'
    AND public.role_feature_access.access_level = 'none'::public.feature_access_level
    THEN 'view'::public.feature_access_level
  ELSE public.role_feature_access.access_level
END;

COMMIT;
