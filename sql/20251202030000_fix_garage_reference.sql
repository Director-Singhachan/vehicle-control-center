-- ========================================
-- Fix Garage Reference in maintenance_history
-- แก้ไขการอ้างอิง garage ใน maintenance_history table
-- ========================================

-- ตรวจสอบว่ามี garage_id column หรือไม่
DO $$ 
BEGIN
  -- ถ้ามี garage_id column ให้เปลี่ยนเป็น garage text
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'maintenance_history' 
      AND column_name = 'garage_id'
  ) THEN
    -- ลบ foreign key constraint (ถ้ามี)
    ALTER TABLE public.maintenance_history 
      DROP CONSTRAINT IF EXISTS maintenance_history_garage_id_fkey;
    
    -- เปลี่ยน column จาก garage_id (uuid) เป็น garage (text)
    ALTER TABLE public.maintenance_history 
      RENAME COLUMN garage_id TO garage;
    
    -- เปลี่ยน data type จาก uuid เป็น text
    ALTER TABLE public.maintenance_history 
      ALTER COLUMN garage TYPE text USING garage::text;
    
    RAISE NOTICE 'Changed garage_id to garage (text) in maintenance_history';
  ELSE
    -- ถ้ายังไม่มี garage column ให้เพิ่มใหม่
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'maintenance_history' 
        AND column_name = 'garage'
    ) THEN
      ALTER TABLE public.maintenance_history 
        ADD COLUMN garage text;
      
      RAISE NOTICE 'Added garage (text) column to maintenance_history';
    END IF;
  END IF;
END $$;

-- เพิ่ม comment
COMMENT ON COLUMN public.maintenance_history.garage IS 'ชื่ออู่ซ่อม/สถานที่ซ่อม (ใช้ text แทน garage_id เพื่อความยืดหยุ่น)';

-- หมายเหตุ:
-- - ใช้ text แทน foreign key เพื่อความยืดหยุ่น
-- - สอดคล้องกับ tickets.garage ที่เป็น text เช่นกัน
-- - ถ้าต้องการใช้ garage table ในอนาคต สามารถสร้าง migration ใหม่ได้

