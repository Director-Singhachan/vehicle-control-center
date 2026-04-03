-- เติม delivery_trip_items.unit จาก order_items สำหรับแถวที่ unit ยังว่าง
-- รันหลัง migration add_delivery_trip_items_unit แล้ว (มีคอลัมน์ unit)
-- หมายเหตุ: ถ้าสินค้า SKU เดียวมีหลายบรรทัดในออเดอร์ Distinct ON อาจเลือกบรรทัดแรกที่ match — ตรวจสอบข้อมูลจริงก่อนใช้งานบนผลิต

UPDATE public.delivery_trip_items dti
SET unit = sub.line_unit
FROM (
  SELECT DISTINCT ON (dti2.id)
    dti2.id AS trip_item_id,
    trim(oi.unit::text) AS line_unit
  FROM public.delivery_trip_items dti2
  INNER JOIN public.delivery_trip_stores dts ON dts.id = dti2.delivery_trip_store_id
  INNER JOIN public.orders o
    ON o.delivery_trip_id = dts.delivery_trip_id
    AND o.store_id = dts.store_id
  INNER JOIN public.order_items oi
    ON oi.order_id = o.id
    AND oi.product_id = dti2.product_id
    AND coalesce(oi.is_bonus, false) = coalesce(dti2.is_bonus, false)
    AND coalesce(oi.fulfillment_method, 'delivery') = 'delivery'
  WHERE oi.unit IS NOT NULL
    AND trim(oi.unit::text) <> ''
    AND (dti2.unit IS NULL OR trim(coalesce(dti2.unit::text, '')) = '')
  ORDER BY dti2.id, o.created_at ASC
) sub
WHERE dti.id = sub.trip_item_id;
