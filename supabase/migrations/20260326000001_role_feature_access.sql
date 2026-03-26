-- Feature access matrix: role + feature_key + access_level
-- Overrides built-in defaults in types/featureAccess.ts when rows exist.

CREATE TYPE public.feature_access_level AS ENUM ('none', 'view', 'edit', 'manage');

CREATE TABLE public.role_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  feature_key text NOT NULL,
  access_level public.feature_access_level NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_feature_access_role_feature_key UNIQUE (role, feature_key)
);

CREATE INDEX role_feature_access_role_idx ON public.role_feature_access (role);

ALTER TABLE public.role_feature_access ENABLE ROW LEVEL SECURITY;

-- อ่านได้เฉพาะแถวของ role ตัวเอง (สำหรับ client โหลดสิทธิ์หลัง login)
CREATE POLICY role_feature_access_select_own_role
  ON public.role_feature_access
  FOR SELECT
  TO authenticated
  USING (
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)
  );

-- เฉพาะ admin จัดการ matrix (หน้า Settings)
CREATE POLICY role_feature_access_admin_all
  ON public.role_feature_access
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

COMMENT ON TABLE public.role_feature_access IS 'Overrides default feature access levels per app_role; empty = use app built-ins';

-- Seed: admin + hr = manage ทุก feature key (สอดคล้องแผน)
INSERT INTO public.role_feature_access (role, feature_key, access_level)
SELECT r.role, f.feature_key, 'manage'::public.feature_access_level
FROM (VALUES ('admin'::public.app_role), ('hr'::public.app_role)) AS r(role)
CROSS JOIN (
  VALUES
    ('tab.reports'),
    ('report.pnl_trip'),
    ('report.pnl_vehicle'),
    ('report.pnl_fleet'),
    ('tab.create_order'),
    ('tab.confirm_orders'),
    ('tab.track_orders'),
    ('tab.sales_trips'),
    ('tab.products'),
    ('tab.product_pricing'),
    ('tab.customer_tiers'),
    ('tab.customers'),
    ('tab.cleanup_test_orders'),
    ('tab.excel_import'),
    ('tab.stock_dashboard'),
    ('tab.warehouses'),
    ('tab.inventory_receipts'),
    ('tab.dashboard'),
    ('tab.vehicles'),
    ('tab.maintenance'),
    ('tab.triplogs'),
    ('tab.fuellogs'),
    ('tab.approvals'),
    ('tab.daily_summary'),
    ('tab.delivery_trips'),
    ('tab.packing_simulation'),
    ('tab.pending_orders'),
    ('tab.pending_sales'),
    ('tab.admin_staff'),
    ('tab.service_staff'),
    ('tab.commission'),
    ('tab.commission_rates'),
    ('tab.profile'),
    ('tab.settings'),
    ('tab.role_feature_access'),
    ('tab.db_explorer')
) AS f(feature_key)
ON CONFLICT (role, feature_key) DO NOTHING;
