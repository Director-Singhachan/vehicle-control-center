-- =============================================
-- Migration: Add unit to order_items (Fixed Version)
-- Description: เพิ่มคอลัมน์ unit และปรับปรุง View โดยการ Drop และ Create ใหม่
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

-- 3. ลบ View เดิมออกก่อน (ต้องใช้ CASCADE หากมี View อื่นมาเรียกใช้ View นี้ต่อ)
DROP VIEW IF EXISTS public.order_items_with_fulfillment CASCADE;

-- 4. สร้าง View ใหม่พร้อมคอลัมน์ unit
CREATE VIEW public.order_items_with_fulfillment AS
SELECT
  oi.id,
  oi.order_id,
  oi.product_id,
  oi.quantity,
  oi.unit_price,
  oi.unit, -- เพิ่มคอลัมน์ unit เข้ามาตรงๆ แทนการใช้ * เพื่อความชัดเจน
  oi.discount_percent,
  oi.discount_amount,
  oi.line_total,
  oi.notes,
  oi.is_bonus,
  oi.fulfillment_method,
  oi.quantity_picked_up_at_store,
  oi.quantity_delivered,
  oi.created_at,
  oi.updated_at,
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

-- 5. หากมี View อื่นที่ถูก CASCADE ลบไป ให้สร้างกลับคืนที่นี่ (ถ้ามี)
-- ปกติ View ที่เรียกใช้ต่ออาจเป็น orders_with_details หรืออื่นๆ 
-- แต่ถ้าไม่มีโครงสร้างที่ซับซ้อน CASCADE จะจัดการ dependencies ที่เป็นฟังก์ชันหรือ trigger บางอย่างให้

COMMIT;
