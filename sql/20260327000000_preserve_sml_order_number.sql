-- ==========================================
-- Migration: Preserve SML Order Numbers
-- Date: 2026-03-27
-- Description: ป้องกันการเคลียร์ order_number เป็น NULL 
-- สำหรับออเดอร์ที่อัพโหลดจาก SML (ตรวจสอบจาก notes) 
-- ทำให้พอไปจัดทริปใหม่ มันจะได้เลข SML เดิมตลอดไป
-- ==========================================

CREATE OR REPLACE FUNCTION public.preserve_sml_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- ถ้าเป็นออเดอร์ที่อัพโหลดจาก SML
  -- และคำสั่ง UPDATE พยายามตั้งค่า order_number ให้เป็น NULL (พฤติกรรมตอนยกเลิกทริป)
  IF OLD.notes LIKE '%(อัพโหลดจาก SML)%' AND NEW.order_number IS NULL THEN
    -- นำ order_number เดิมกลับมาใช้ (ไม่ยอมให้เป็น NULL)
    NEW.order_number := OLD.order_number;
  END IF;

  RETURN NEW;
END;
$$;

-- ลบ Trigger เก่าถ้ามี (เพื่อความปลอดภัยหากรันซ้ำ)
DROP TRIGGER IF EXISTS trigger_preserve_sml_order_number ON public.orders;

-- สร้าง Trigger ใหม่ (ให้ทำงาน BEFORE UPDATE เพื่อขัดขวางการเปลี่ยนค่า)
CREATE TRIGGER trigger_preserve_sml_order_number
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_sml_order_number();

-- ตรวจสอบ
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'preserve_sml_order_number') THEN
    RAISE NOTICE '✅ Function preserve_sml_order_number created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create function preserve_sml_order_number';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_preserve_sml_order_number') THEN
    RAISE NOTICE '✅ Trigger trigger_preserve_sml_order_number created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create trigger trigger_preserve_sml_order_number';
  END IF;
END $$;
