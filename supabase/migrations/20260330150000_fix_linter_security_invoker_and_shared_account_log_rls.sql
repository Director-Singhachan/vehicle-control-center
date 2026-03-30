-- Supabase database linter:
-- 0010_security_definer_view: order_items_with_fulfillment
-- 0013_rls_disabled_in_public: shared_account_activity_log

-- 1) View: ใช้สิทธิ์ของผู้เรียกดู (RLS ของ base tables) แทนเจ้าของ view
ALTER VIEW public.order_items_with_fulfillment SET (security_invoker = true);

-- 2) ตาราง log บัญชีใช้ร่วม: เปิด RLS + นโยบายเฉพาะเจ้าของ profile และแอดมิน
ALTER TABLE public.shared_account_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_account_activity_log_insert_own_profile ON public.shared_account_activity_log;
CREATE POLICY shared_account_activity_log_insert_own_profile
  ON public.shared_account_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.service_staff ss
      WHERE ss.id = staff_id
        AND ss.user_id = (select auth.uid())
        AND ss.status = 'active'
    )
  );

DROP POLICY IF EXISTS shared_account_activity_log_select_own_or_admin ON public.shared_account_activity_log;
CREATE POLICY shared_account_activity_log_select_own_or_admin
  ON public.shared_account_activity_log
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.shared_account_activity_log IS
  'Logs actions performed by individual staff members using a shared account. RLS: insert when staff belongs to session user; select own profile or admin.';
