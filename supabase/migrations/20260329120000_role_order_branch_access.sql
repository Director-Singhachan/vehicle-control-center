-- สาขาที่แต่ละ app_role ใช้สร้าง/มองเห็นออเดอร์ (คลัง + ร้าน + filter ออเดอร์)
-- ไม่มีแถวสำหรับ role = ใช้กฎเดิมในแอป (ผู้บริหาร + สำนักงานใหญ่เห็นทุกสาขา / อื่นๆ ตามสาขาในโปรไฟล์)

CREATE TABLE public.role_order_branch_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  branch text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_order_branch_access_role_branch UNIQUE (role, branch)
);

CREATE INDEX role_order_branch_access_role_idx ON public.role_order_branch_access (role);

ALTER TABLE public.role_order_branch_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_order_branch_access_select_own_role
  ON public.role_order_branch_access
  FOR SELECT
  TO authenticated
  USING (
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)
  );

CREATE POLICY role_order_branch_access_admin_all
  ON public.role_order_branch_access
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

COMMENT ON TABLE public.role_order_branch_access IS 'คีย์สาขาที่อนุญาตสำหรับฟังก์ชันออเดอร์ต่อบทบาท; ว่าง = ใช้ logic เดิมในโค้ด';
