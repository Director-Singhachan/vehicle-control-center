-- แทนที่ role_order_branch_access: ตั้งค่าเป็นคู่ (บทบาท + สาขาในโปรไฟล์) + โหมดมองเห็นออเดอร์

DROP TABLE IF EXISTS public.role_order_branch_access;

CREATE TYPE public.order_branch_visibility AS ENUM ('all_branches', 'own_branch_only');

CREATE TABLE public.role_order_branch_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  profile_branch text NOT NULL,
  visibility public.order_branch_visibility NOT NULL DEFAULT 'own_branch_only',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_order_branch_scope_role_profile UNIQUE (role, profile_branch),
  CONSTRAINT role_order_branch_scope_profile_branch_check CHECK (profile_branch IN ('HQ', 'SD', 'Asia'))
);

CREATE INDEX role_order_branch_scope_role_idx ON public.role_order_branch_scope (role);

ALTER TABLE public.role_order_branch_scope ENABLE ROW LEVEL SECURITY;

-- ผู้ใช้ทั่วไปอ่านแถวที่ตรงกับบทบาทและสาขาโปรไฟล์ของตัวเอง
CREATE POLICY role_order_branch_scope_select_own
  ON public.role_order_branch_scope
  FOR SELECT
  TO authenticated
  USING (
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)
    AND profile_branch = (
      SELECT COALESCE(NULLIF(TRIM(p.branch), ''), 'HQ')
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY role_order_branch_scope_admin_all
  ON public.role_order_branch_scope
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.role_order_branch_scope IS 'มองเห็นออเดอร์: (role + สาขาในโปรไฟล์) → all_branches | own_branch_only; ไม่มีแถว = ใช้กฎเริ่มต้นในแอป';
