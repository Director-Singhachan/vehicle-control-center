-- Tier 3: แยก delta ขนส่ง — จำนวนที่ถือว่าส่งครบจากบิล/ทริปก่อน (บิลแก้) ลดค้างส่งโดยไม่แก้ยอดบรรทัดทางบัญชี
-- Tier 4: กันยอดรายได้ซ้ำ — ออเดอร์เดิมที่มีออเดอร์ใหม่ผูก (related_prior_order_id) ถูกตัดออกจาก rollup รายได้ต่อรถ

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS quantity_fulfilled_prior_bill numeric NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_quantity_fulfilled_prior_bill_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_fulfilled_prior_bill_check
  CHECK (quantity_fulfilled_prior_bill >= 0);

COMMENT ON COLUMN public.order_items.quantity_fulfilled_prior_bill IS
  'จำนวนที่ถือว่าส่งครบแล้วจากทริป/บิลก่อนหน้า (เคสบิลแก้เลขเอกสารใหม่) — ใช้ลดค้างส่ง/แผนขนส่ง ไม่รวม quantity_delivered ของออเดอร์นี้';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS exclude_from_vehicle_revenue_rollup boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.exclude_from_vehicle_revenue_rollup IS
  'เมื่อมีออเดอร์ใหม่ผูก related_prior_order_id มาที่ออเดอร์นี้ — ตัดยอด total_amount ออกจากสรุปรายได้ต่อรถเพื่อกันซ้ำกับบิลแก้';

-- อัปเดต view: หัก quantity_fulfilled_prior_bill จาก remaining_unallocated
CREATE OR REPLACE VIEW public.order_item_remaining_quantities AS
SELECT
  oi.id                                AS order_item_id,
  oi.order_id,
  oi.product_id,
  oi.quantity                          AS total_quantity,
  oi.quantity_picked_up_at_store,
  oi.quantity_delivered,
  oi.fulfillment_method,
  COALESCE(
    SUM(a.allocated_quantity)
    FILTER (WHERE a.status <> 'cancelled'),
    0
  )                                    AS allocated_quantity,
  COALESCE(
    SUM(a.delivered_quantity)
    FILTER (WHERE a.status = 'delivered'),
    0
  )                                    AS fulfilled_via_allocations,
  GREATEST(0,
    oi.quantity
    - oi.quantity_picked_up_at_store
    - COALESCE(oi.quantity_fulfilled_prior_bill, 0)
    - COALESCE(
        SUM(a.allocated_quantity)
        FILTER (WHERE a.status <> 'cancelled'),
        0
      )
  )                                    AS remaining_unallocated,
  EXISTS (
    SELECT 1
    FROM   public.order_delivery_trip_allocations x
    WHERE  x.order_item_id = oi.id
      AND  x.status <> 'cancelled'
  )                                    AS has_allocations
FROM      public.order_items oi
LEFT JOIN public.order_delivery_trip_allocations a ON a.order_item_id = oi.id
GROUP BY  oi.id, oi.order_id, oi.product_id, oi.quantity,
          oi.quantity_picked_up_at_store, oi.quantity_delivered,
          oi.quantity_fulfilled_prior_bill,
          oi.fulfillment_method;

ALTER VIEW public.order_item_remaining_quantities SET (security_invoker = true);

-- Backfill: ออเดอร์ที่มีลูกผูกมาแล้ว
UPDATE public.orders o
SET exclude_from_vehicle_revenue_rollup = true
WHERE EXISTS (
  SELECT 1 FROM public.orders c WHERE c.related_prior_order_id = o.id
);

-- Trigger: เมื่อมีการผูกออเดอร์ใหม่ → ทำเครื่องหมายออเดอร์เดิม
CREATE OR REPLACE FUNCTION public.trg_orders_set_prior_excluded_from_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.related_prior_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET exclude_from_vehicle_revenue_rollup = true
    WHERE id = NEW.related_prior_order_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_prior_revenue_exclusion ON public.orders;
CREATE TRIGGER trg_orders_prior_revenue_exclusion
  AFTER INSERT OR UPDATE OF related_prior_order_id ON public.orders
  FOR EACH ROW
  WHEN (NEW.related_prior_order_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_orders_set_prior_excluded_from_revenue();
