-- =============================================
-- Migration: Add unit to order_items
-- Description: เพิ่มคอลัมน์ unit เพื่อรองรับการเก็บหน่วยสินค้าแยกรายบรรทัด
-- =============================================

BEGIN;

-- 1. เพิ่มคอลัมน์ unit ใน order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS unit TEXT;

COMMENT ON COLUMN public.order_items.unit IS 'หน่วยสินค้าที่ใช้ในรายการนี้ (เช่น ลัง, ขวด, กล่อง)';

-- 2. คัดลอกหน่วยปัจจุบันจากตาราง products มาใส่ในรายการที่มีอยู่แล้ว (Backfill)
UPDATE public.order_items oi
SET unit = p.unit
FROM public.products p
WHERE oi.product_id = p.id AND oi.unit IS NULL;

-- 3. ปรับปรุง View order_items_with_fulfillment ให้ดึง unit ออกมาด้วย
CREATE OR REPLACE VIEW public.order_items_with_fulfillment AS
SELECT
  oi.*,
  p.product_name,
  p.product_code,
  GREATEST(0, oi.quantity - oi.quantity_picked_up_at_store - oi.quantity_delivered) AS quantity_remaining,
  CASE
    WHEN oi.quantity = 0 THEN 'fulfilled'
    WHEN (oi.quantity_picked_up_at_store + oi.quantity_delivered) >= oi.quantity THEN 'fulfilled'
    WHEN (oi.quantity_picked_up_at_store + oi.quantity_delivered) > 0 THEN 'partial'
    ELSE 'pending'
  END AS fulfillment_status
FROM public.order_items oi
LEFT JOIN public.products p ON oi.product_id = p.id;

COMMIT;
