-- ========================================
-- Add Bonus Items Support to Orders
-- Migration: 20260208000001_add_bonus_items_to_orders.sql
-- ========================================
-- เพิ่มฟิลด์ is_bonus ใน order_items เพื่อรองรับการระบุสินค้าแถม
-- ========================================

BEGIN;

-- ========================================
-- 1. เพิ่มฟิลด์ is_bonus ใน order_items
-- ========================================
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN NOT NULL DEFAULT false;

-- ========================================
-- 2. เพิ่ม index สำหรับการค้นหา
-- ========================================
CREATE INDEX IF NOT EXISTS idx_order_items_is_bonus 
ON public.order_items(order_id, is_bonus);

-- ========================================
-- 3. Comment
-- ========================================
COMMENT ON COLUMN public.order_items.is_bonus IS 
  'ระบุว่ารายการนี้เป็นของแถมหรือไม่ (true = ของแถม, false = สินค้าปกติ)';

COMMIT;

-- ========================================
-- ตรวจสอบ
-- ========================================
-- SELECT 
--   column_name,
--   data_type,
--   column_default,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'order_items'
--   AND column_name = 'is_bonus';
