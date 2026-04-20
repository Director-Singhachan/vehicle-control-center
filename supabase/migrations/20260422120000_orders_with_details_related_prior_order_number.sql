-- แสดงเลขออเดอร์บิลเดิมเมื่อบิลใหม่ผูก related_prior_order_id (ไม่ต้องไล่ UUID)
DROP VIEW IF EXISTS public.pending_orders CASCADE;
DROP VIEW IF EXISTS public.orders_with_details CASCADE;

CREATE VIEW public.orders_with_details AS
SELECT
  o.*,
  prior_po.order_number AS related_prior_order_number,
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
FROM      public.orders o
LEFT JOIN public.orders prior_po ON prior_po.id = o.related_prior_order_id
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

COMMENT ON COLUMN public.orders_with_details.related_prior_order_number IS
  'เลขออเดอร์ของบิลเดิม (เมื่อ related_prior_order_id ชี้ไปออเดอร์เดิม) — คำนวณจาก JOIN';

GRANT SELECT ON public.orders_with_details TO authenticated;
GRANT SELECT ON public.pending_orders TO authenticated;
