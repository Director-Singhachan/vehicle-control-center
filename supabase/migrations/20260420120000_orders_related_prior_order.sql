-- เชื่อมออเดอร์ใหม่กับออเดอร์เดิม (กรณีแก้บิลหลังส่ง / เลขเอกสาร SML ใหม่)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS related_prior_order_id uuid NULL
    REFERENCES public.orders (id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS replaces_sml_doc_no text NULL;

CREATE INDEX IF NOT EXISTS idx_orders_related_prior_order_id
  ON public.orders (related_prior_order_id)
  WHERE related_prior_order_id IS NOT NULL;

COMMENT ON COLUMN public.orders.related_prior_order_id IS
  'ออเดอร์เดิมที่เคสนี้สืบหรือแทนที่ (เช่น แก้บิลหลังทริปล็อค) — FK ไป orders.id';

COMMENT ON COLUMN public.orders.replaces_sml_doc_no IS
  'เลขเอกสาร SML ของบิลเดิมที่ถูกแทนที่ (บันทึกมือ ถ้าต้องการอ้างอิงนอก UUID)';

-- View ใช้ o.* — ต้อง recreate เพื่อให้คอลัมน์ใหม่ปรากฏใน orders_with_details
DROP VIEW IF EXISTS public.pending_orders CASCADE;
DROP VIEW IF EXISTS public.orders_with_details CASCADE;

CREATE VIEW public.orders_with_details AS
SELECT
  o.*,
  s.customer_code,
  s.customer_name,
  s.address AS store_address,
  s.phone AS store_phone,
  ct.tier_code,
  ct.tier_name,
  ct.color AS tier_color,
  dt.trip_number,
  dt.status AS trip_status,
  dt.planned_date AS trip_date,
  creator.full_name AS created_by_name,
  confirmer.full_name AS confirmed_by_name,
  (SELECT COUNT(*) FROM public.order_items WHERE order_id = o.id) AS items_count,
  (SELECT COALESCE(SUM(quantity), 0) FROM public.order_items WHERE order_id = o.id) AS total_quantity,
  CASE
    WHEN COALESCE(o.total_amount, 0) <> 0 THEN o.total_amount
    ELSE COALESCE(
      (SELECT SUM(oi.line_total) FROM public.order_items oi WHERE oi.order_id = o.id),
      0
    )
  END AS display_total_amount
FROM public.orders o
LEFT JOIN public.stores s ON o.store_id = s.id
LEFT JOIN public.customer_tiers ct ON s.tier_id = ct.id
LEFT JOIN public.delivery_trips dt ON o.delivery_trip_id = dt.id
LEFT JOIN public.profiles creator ON o.created_by = creator.id
LEFT JOIN public.profiles confirmer ON o.confirmed_by = confirmer.id;

ALTER VIEW public.orders_with_details SET (security_invoker = true);

CREATE VIEW public.pending_orders AS
SELECT *
FROM public.orders_with_details
WHERE status IN ('confirmed')
  AND delivery_trip_id IS NULL
ORDER BY order_date, created_at;

ALTER VIEW public.pending_orders SET (security_invoker = true);

GRANT SELECT ON public.orders_with_details TO authenticated;
GRANT SELECT ON public.pending_orders TO authenticated;
