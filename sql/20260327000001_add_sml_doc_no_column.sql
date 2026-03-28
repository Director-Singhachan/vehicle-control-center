-- ==========================================
-- Migration: Add sml_doc_no column to orders
-- Date: 2026-03-27
-- Description:
--   1. เพิ่มคอลัมน์ sml_doc_no สำหรับเก็บรหัสจาก SML แยกจาก order_number
--   2. ลบ Trigger เดิมที่ป้องกัน order_number ถูกล้าง (ไม่จำเป็นแล้ว)
--   3. Backfill ข้อมูลเก่า: ถ้า order มี notes "(อัพโหลดจาก SML)" → คัดลอก order_number → sml_doc_no
-- ==========================================

-- STEP 1: เพิ่มคอลัมน์ sml_doc_no
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sml_doc_no TEXT NULL;

-- STEP 2: ลบ Trigger เดิมที่ป้องกัน order_number (ไม่จำเป็นแล้ว)
DROP TRIGGER IF EXISTS trigger_preserve_sml_order_number ON public.orders;
DROP FUNCTION IF EXISTS public.preserve_sml_order_number();

-- STEP 3: Backfill ข้อมูลเก่า
-- ออเดอร์ที่อัพโหลดจาก SML (ดูจาก notes) แต่ยังไม่มี sml_doc_no
-- → คัดลอก order_number ไปเป็น sml_doc_no
UPDATE public.orders
SET sml_doc_no = order_number
WHERE notes LIKE '%(อัพโหลดจาก SML)%'
  AND sml_doc_no IS NULL
  AND order_number IS NOT NULL;

-- STEP 4: ตรวจสอบผลลัพธ์
DO $$
DECLARE
  v_col_exists BOOLEAN;
  v_backfilled INTEGER;
BEGIN
  -- ตรวจสอบว่าคอลัมน์มีอยู่
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'sml_doc_no'
  ) INTO v_col_exists;

  IF v_col_exists THEN
    RAISE NOTICE '✅ Column sml_doc_no added successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to add column sml_doc_no';
  END IF;

  -- นับจำนวนที่ backfill
  SELECT COUNT(*) INTO v_backfilled
  FROM public.orders
  WHERE sml_doc_no IS NOT NULL;

  RAISE NOTICE '✅ Backfilled % orders with sml_doc_no', v_backfilled;

  -- ตรวจสอบว่า trigger เก่าถูกลบ
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_preserve_sml_order_number'
  ) THEN
    RAISE NOTICE '✅ Old trigger removed successfully';
  ELSE
    RAISE WARNING '⚠️ Old trigger still exists';
  END IF;
END $$;
