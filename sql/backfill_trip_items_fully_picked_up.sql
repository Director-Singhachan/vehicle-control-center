-- ========================================
-- Backfill: เพิ่ม delivery_trip_items สำหรับรายการที่รับที่ร้านครบ
-- ========================================
-- สำหรับทริปที่สร้างก่อนแก้ไข CreateTripFromOrdersView (filter รายการ qty>0 เท่านั้น)
-- รายการที่ลูกค้ารับที่ร้านครบ (remaining=0, picked_up>0) ไม่ถูกเพิ่ม → ไม่แสดงในใบแจ้งหนี้
-- สคริปต์นี้จะ INSERT รายการที่หายไป
-- ========================================

-- 1. ตรวจสอบรายการที่จะถูกเพิ่ม (รันก่อน INSERT จริง)
-- ========================================
SELECT
  o.order_number,
  dt.trip_number,
  s.customer_name AS store_name,
  p.product_code,
  p.product_name,
  oi.quantity AS ordered_qty,
  oi.quantity_picked_up_at_store,
  oi.quantity_delivered,
  (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = o.delivery_trip_id AND dts.store_id = o.store_id
JOIN public.delivery_trips dt ON dt.id = o.delivery_trip_id
JOIN public.order_items oi ON oi.order_id = o.id
JOIN public.stores s ON s.id = o.store_id
JOIN public.products p ON p.id = oi.product_id
WHERE o.delivery_trip_id IS NOT NULL
  AND dt.status != 'cancelled'
  AND (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) <= 0
  AND COALESCE(oi.quantity_picked_up_at_store, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.delivery_trip_items dti
    WHERE dti.delivery_trip_store_id = dts.id
      AND dti.product_id = oi.product_id
      AND COALESCE(dti.is_bonus, false) = COALESCE(oi.is_bonus, false)
  )
ORDER BY o.order_number, p.product_code;

-- 2. INSERT รายการที่หายไป
-- ========================================
INSERT INTO public.delivery_trip_items (
  delivery_trip_id,
  delivery_trip_store_id,
  product_id,
  quantity,
  quantity_picked_up_at_store,
  notes,
  is_bonus
)
SELECT
  o.delivery_trip_id,
  dts.id AS delivery_trip_store_id,
  oi.product_id,
  oi.quantity,
  COALESCE(oi.quantity_picked_up_at_store, 0),
  oi.notes,
  COALESCE(oi.is_bonus, false)
FROM public.orders o
JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = o.delivery_trip_id AND dts.store_id = o.store_id
JOIN public.delivery_trips dt ON dt.id = o.delivery_trip_id
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.delivery_trip_id IS NOT NULL
  AND dt.status != 'cancelled'
  AND (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) <= 0
  AND COALESCE(oi.quantity_picked_up_at_store, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.delivery_trip_items dti
    WHERE dti.delivery_trip_store_id = dts.id
      AND dti.product_id = oi.product_id
      AND COALESCE(dti.is_bonus, false) = COALESCE(oi.is_bonus, false)
  );
