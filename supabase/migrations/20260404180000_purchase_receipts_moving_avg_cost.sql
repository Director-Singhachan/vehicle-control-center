-- Phase 1: บันทึกใบรับซื้อ (ไม่ตัดสต็อก) + ต้นทุนเฉลี่ยเคลื่อนที่ต่อคลัง/สินค้า
-- ใช้สำหรับวิเคราะห์กำไร — basis_qty เป็นปริมาณสะสมสำหรับคำนวณ MA เท่านั้น ไม่ใช่ยอดสต็อกคงเหลือ

BEGIN;

CREATE TABLE public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_date date NOT NULL DEFAULT (CURRENT_DATE),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  supplier_name text,
  invoice_ref text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_receipt_id uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text,
  unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
  line_total numeric GENERATED ALWAYS AS (round(quantity * unit_cost, 2)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_receipts_warehouse ON public.purchase_receipts(warehouse_id);
CREATE INDEX idx_purchase_receipts_status ON public.purchase_receipts(status);
CREATE INDEX idx_purchase_receipts_date ON public.purchase_receipts(receipt_date);
CREATE INDEX idx_purchase_receipt_items_receipt ON public.purchase_receipt_items(purchase_receipt_id);
CREATE INDEX idx_purchase_receipt_items_product ON public.purchase_receipt_items(product_id);

CREATE TABLE public.product_moving_avg_costs (
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  basis_qty numeric NOT NULL DEFAULT 0 CHECK (basis_qty >= 0),
  total_cost_value numeric NOT NULL DEFAULT 0,
  avg_unit_cost numeric NOT NULL DEFAULT 0 CHECK (avg_unit_cost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, product_id)
);

CREATE INDEX idx_product_moving_avg_product ON public.product_moving_avg_costs(product_id);

COMMENT ON TABLE public.purchase_receipts IS 'ใบรับซื้อ/ต้นทุน — โพสต์แล้วอัปเดต product_moving_avg_costs (ไม่แตะ inventory)';
COMMENT ON TABLE public.product_moving_avg_costs IS 'ต้นทุนเฉลี่ยเคลื่อนที่สำหรับวิเคราะห์ — basis_qty ไม่เท่ากับสต็อกจริง';

-- โพสต์ใบรับ: อัปเดต MA ต่อบรรทัด (ห้ามใบเดียวโพสต์ซ้ำ)
CREATE OR REPLACE FUNCTION public.post_purchase_receipt(p_receipt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  line record;
  prev_basis numeric;
  prev_total numeric;
  new_basis numeric;
  new_total numeric;
  new_avg numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO rec
  FROM public.purchase_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt not found';
  END IF;

  IF rec.status <> 'draft' THEN
    RAISE EXCEPTION 'receipt must be draft';
  END IF;

  FOR line IN
    SELECT * FROM public.purchase_receipt_items
    WHERE purchase_receipt_id = p_receipt_id
    ORDER BY id
  LOOP
    SELECT mc.basis_qty, mc.total_cost_value
    INTO prev_basis, prev_total
    FROM public.product_moving_avg_costs mc
    WHERE mc.warehouse_id = rec.warehouse_id
      AND mc.product_id = line.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      prev_basis := 0;
      prev_total := 0;
    END IF;

    IF prev_basis IS NULL THEN prev_basis := 0; END IF;
    IF prev_total IS NULL THEN prev_total := 0; END IF;

    IF prev_basis <= 0 THEN
      new_basis := line.quantity;
      new_total := round(line.quantity * line.unit_cost, 2);
      new_avg := CASE WHEN line.quantity > 0 THEN round(new_total / line.quantity, 4) ELSE 0 END;
    ELSE
      new_total := round(prev_total + line.quantity * line.unit_cost, 2);
      new_basis := prev_basis + line.quantity;
      new_avg := CASE WHEN new_basis > 0 THEN round(new_total / new_basis, 4) ELSE 0 END;
    END IF;

    INSERT INTO public.product_moving_avg_costs (
      warehouse_id, product_id, basis_qty, total_cost_value, avg_unit_cost, updated_at
    )
    VALUES (
      rec.warehouse_id, line.product_id, new_basis, new_total, new_avg, now()
    )
    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
      basis_qty = EXCLUDED.basis_qty,
      total_cost_value = EXCLUDED.total_cost_value,
      avg_unit_cost = EXCLUDED.avg_unit_cost,
      updated_at = EXCLUDED.updated_at;
  END LOOP;

  UPDATE public.purchase_receipts
  SET status = 'posted',
      posted_at = now(),
      updated_at = now()
  WHERE id = p_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_purchase_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_purchase_receipt(uuid) TO authenticated;

ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_moving_avg_costs ENABLE ROW LEVEL SECURITY;

-- อ่าน/เขียนใบรับ: admin, hr, accounting, warehouse
CREATE POLICY purchase_receipts_select
  ON public.purchase_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse', 'manager', 'executive')
    )
  );

CREATE POLICY purchase_receipts_insert
  ON public.purchase_receipts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY purchase_receipts_update
  ON public.purchase_receipts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
    )
    AND status = 'draft'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
    )
    AND status IN ('draft', 'cancelled')
  );

CREATE POLICY purchase_receipt_items_select
  ON public.purchase_receipt_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_receipts r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = purchase_receipt_items.purchase_receipt_id
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse', 'manager', 'executive')
    )
  );

CREATE POLICY purchase_receipt_items_insert
  ON public.purchase_receipt_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_receipts r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = purchase_receipt_items.purchase_receipt_id
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
    )
    AND EXISTS (SELECT 1 FROM public.purchase_receipts r2 WHERE r2.id = purchase_receipt_id AND r2.status = 'draft')
  );

CREATE POLICY purchase_receipt_items_update
  ON public.purchase_receipt_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_receipts r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = purchase_receipt_items.purchase_receipt_id
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
    )
    AND EXISTS (SELECT 1 FROM public.purchase_receipts r2 WHERE r2.id = purchase_receipt_id AND r2.status = 'draft')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_receipts r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = purchase_receipt_items.purchase_receipt_id
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
    )
  );

CREATE POLICY purchase_receipt_items_delete
  ON public.purchase_receipt_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_receipts r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = purchase_receipt_items.purchase_receipt_id
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse')
    )
    AND EXISTS (SELECT 1 FROM public.purchase_receipts r2 WHERE r2.id = purchase_receipt_id AND r2.status = 'draft')
  );

CREATE POLICY product_moving_avg_costs_select
  ON public.product_moving_avg_costs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'hr', 'accounting', 'warehouse', 'manager', 'executive')
    )
  );

-- ไม่เปิด insert/update โดยตรง — เฉพาะ RPC post_purchase_receipt (SECURITY DEFINER)

GRANT SELECT, INSERT, UPDATE ON public.purchase_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipt_items TO authenticated;
GRANT SELECT ON public.product_moving_avg_costs TO authenticated;

INSERT INTO public.role_feature_access (role, feature_key, access_level)
VALUES
  ('admin', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('hr', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('accounting', 'tab.purchase_receipts', 'manage'::public.feature_access_level),
  ('warehouse', 'tab.purchase_receipts', 'manage'::public.feature_access_level)
ON CONFLICT (role, feature_key) DO NOTHING;

COMMIT;
