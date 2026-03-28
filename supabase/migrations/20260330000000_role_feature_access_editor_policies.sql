CREATE OR REPLACE FUNCTION public.current_user_can_use_role_feature_access(
  p_min_level public.feature_access_level DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH current_profile AS (
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1
  )
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM current_profile cp
      WHERE cp.role IN ('admin'::public.app_role, 'hr'::public.app_role)
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM current_profile cp
      JOIN public.role_feature_access rfa
        ON rfa.role = cp.role
      WHERE rfa.feature_key = 'tab.role_feature_access'
        AND rfa.access_level >= p_min_level
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can_use_role_feature_access(public.feature_access_level) TO authenticated;

DROP POLICY IF EXISTS role_feature_access_admin_all ON public.role_feature_access;

CREATE POLICY role_feature_access_feature_view_all
  ON public.role_feature_access
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_use_role_feature_access('view'));

CREATE POLICY role_feature_access_feature_insert_all
  ON public.role_feature_access
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_use_role_feature_access('edit'));

CREATE POLICY role_feature_access_feature_update_all
  ON public.role_feature_access
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_use_role_feature_access('edit'))
  WITH CHECK (public.current_user_can_use_role_feature_access('edit'));

CREATE POLICY role_feature_access_feature_delete_all
  ON public.role_feature_access
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_use_role_feature_access('edit'));

DROP POLICY IF EXISTS role_order_branch_scope_admin_all ON public.role_order_branch_scope;

CREATE POLICY role_order_branch_scope_feature_view_all
  ON public.role_order_branch_scope
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_use_role_feature_access('view'));

CREATE POLICY role_order_branch_scope_feature_insert_all
  ON public.role_order_branch_scope
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_use_role_feature_access('edit'));

CREATE POLICY role_order_branch_scope_feature_update_all
  ON public.role_order_branch_scope
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_use_role_feature_access('edit'))
  WITH CHECK (public.current_user_can_use_role_feature_access('edit'));

CREATE POLICY role_order_branch_scope_feature_delete_all
  ON public.role_order_branch_scope
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_use_role_feature_access('edit'));
