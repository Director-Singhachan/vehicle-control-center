-- Migration: เพิ่ม fulfillment_method ใน order_items
-- 'delivery' = ให้บริษัทจัดส่ง (เข้า trip), 'pickup' = ลูกค้ามารับเอง (ไม่เข้า trip ต้องมีใบเบิก)

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery'
    CHECK (fulfillment_method IN ('delivery', 'pickup'));

COMMENT ON COLUMN public.order_items.fulfillment_method IS
  'delivery = ให้บริษัทจัดส่ง (เข้า trip), pickup = ลูกค้ามารับเอง (ไม่เข้า trip ต้องมีใบเบิก)';

-- Backfill: ออเดอร์เดิมถือเป็น delivery ทั้งหมด (default ทำให้ไม่ต้อง backfill แต่ใส่ไว้ safety)
UPDATE public.order_items SET fulfillment_method = 'delivery' WHERE fulfillment_method IS NULL;
