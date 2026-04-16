-- ============================================================
-- Multi-trip Order Support: allocation table + remaining-quantity view
-- ============================================================
-- This migration introduces the junction table that allows one order to
-- be split across an unlimited number of delivery trips (partial deliveries).
-- `orders.delivery_trip_id` is preserved for backward compatibility but is
-- no longer the primary source of truth for multi-leg orders.
-- ============================================================

-- 1. Main allocation table
CREATE TABLE IF NOT EXISTS public.order_delivery_trip_allocations (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id            uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_trip_id    uuid        NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  order_item_id       uuid        NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  allocated_quantity  numeric     NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
  delivered_quantity  numeric     NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
  status              text        NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'in_delivery', 'delivered', 'cancelled')),
  sequence_no         integer     NOT NULL DEFAULT 1,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odta_order_id      ON public.order_delivery_trip_allocations (order_id);
CREATE INDEX IF NOT EXISTS idx_odta_trip_id       ON public.order_delivery_trip_allocations (delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_odta_order_item_id ON public.order_delivery_trip_allocations (order_item_id);

COMMENT ON TABLE public.order_delivery_trip_allocations IS
  'Junction table: records how many units of each order item are allocated to each delivery trip. '
  'Supports partial delivery — one order can span N trips.';

-- 2. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_odta_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_odta_updated_at ON public.order_delivery_trip_allocations;
CREATE TRIGGER trg_odta_updated_at
  BEFORE UPDATE ON public.order_delivery_trip_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_odta_updated_at();

-- 3. View: per-order-item fulfillment summary (allocated / delivered / remaining)
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
          oi.fulfillment_method;

-- 4. View: per-order remaining summary (used for the Partial Delivery Queue)
CREATE OR REPLACE VIEW public.order_remaining_summary AS
SELECT
  o.id                                 AS order_id,
  o.store_id,
  o.branch,
  o.status                             AS order_status,
  COUNT(DISTINCT a.delivery_trip_id)
    FILTER (WHERE a.status <> 'cancelled') AS trip_count,
  COALESCE(
    SUM(r.remaining_unallocated)
    FILTER (WHERE r.fulfillment_method <> 'pickup'),
    0
  )                                    AS total_remaining,
  COALESCE(
    SUM(r.allocated_quantity)
    FILTER (WHERE r.fulfillment_method <> 'pickup'),
    0
  )                                    AS total_allocated,
  COALESCE(
    SUM(r.total_quantity)
    FILTER (WHERE r.fulfillment_method <> 'pickup'),
    0
  )                                    AS total_delivery_qty,
  EXISTS (
    SELECT 1
    FROM   public.order_delivery_trip_allocations ax
    WHERE  ax.order_id = o.id
      AND  ax.status <> 'cancelled'
  )                                    AS has_any_allocation
FROM      public.orders o
LEFT JOIN public.order_item_remaining_quantities r ON r.order_id = o.id
LEFT JOIN public.order_delivery_trip_allocations a ON a.order_id = o.id
GROUP BY  o.id, o.store_id, o.branch, o.status;

-- 5. RLS
ALTER TABLE public.order_delivery_trip_allocations ENABLE ROW LEVEL SECURITY;

-- Logistics and sales can read allocations
CREATE POLICY "odta_select_authenticated"
  ON public.order_delivery_trip_allocations
  FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users with write access can insert/update/delete
CREATE POLICY "odta_insert_authenticated"
  ON public.order_delivery_trip_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "odta_update_authenticated"
  ON public.order_delivery_trip_allocations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "odta_delete_authenticated"
  ON public.order_delivery_trip_allocations
  FOR DELETE
  TO authenticated
  USING (true);
