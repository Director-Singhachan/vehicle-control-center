-- ========================================
-- Backfill: แก้ delivery_trip_items ให้แสดงจำนวนสั่ง + รับที่ร้าน ถูกต้องสำหรับใบแจ้งหนี้
-- รันหลังจาก 20260321000000_sync_pickup_from_order_to_trip.sql
-- ========================================
-- สำหรับทริปที่สร้างก่อนแก้ไข ข้อมูลใน delivery_trip_items อาจเป็นจำนวนคงเหลือ (150)
-- แทนจำนวนสั่ง (200) — สคริปต์นี้จะอัปเดตจาก order_items ให้ถูกต้อง
-- ========================================

-- อัปเดต delivery_trip_items จาก order_items ที่ตรงกัน (ผ่าน orders + delivery_trip_stores)
UPDATE public.delivery_trip_items dti
SET
  quantity = sub.quantity,
  quantity_picked_up_at_store = sub.quantity_picked_up_at_store,
  updated_at = NOW()
FROM (
  SELECT
    dti2.id AS dti_id,
    SUM(oi.quantity)::numeric AS quantity,
    SUM(COALESCE(oi.quantity_picked_up_at_store, 0))::numeric AS quantity_picked_up_at_store
  FROM public.delivery_trip_items dti2
  JOIN public.delivery_trip_stores dts ON dts.id = dti2.delivery_trip_store_id
  JOIN public.orders o ON o.store_id = dts.store_id AND o.delivery_trip_id = dts.delivery_trip_id
  JOIN public.order_items oi ON oi.order_id = o.id
    AND oi.product_id = dti2.product_id
    AND COALESCE(oi.is_bonus, false) = COALESCE(dti2.is_bonus, false)
  WHERE dts.delivery_trip_id IN (
    SELECT id FROM public.delivery_trips WHERE status != 'cancelled'
  )
  GROUP BY dti2.id
) sub
WHERE dti.id = sub.dti_id;
