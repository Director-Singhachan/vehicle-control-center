-- ========================================
-- ลูกค้ารหัสเดียวกันหลายสาขา (ไม่ลบการตรวจสอบร้านซ้ำในทริป)
-- Migration: 20260205000002_allow_same_store_multiple_stops_in_trip.sql
-- ========================================
-- แนวคิด:
--   - ยังคงตรวจสอบ "ร้านซ้ำ" ในทริปเหมือนเดิม (store_id เดียวกันในทริปเดียวกันไม่ได้)
--   - รองรับเคส "ลูกค้ารหัสเดียวกันแต่คนละสาขา" โดยให้สร้างได้หลายร้าน (หลาย store_id)
--     ที่ใช้ customer_code เดียวกัน แต่แยกด้วยสาขา/ที่อยู่
--   - ฝ่ายขาย: สร้างร้านหลัก 1 รายการ + สร้างร้านเพิ่มด้วยรหัสลูกค้าเดียวกัน ระบุสาขา/ที่อยู่
--     → ได้ store_id คนละอัน → เวลาจัดทริปถือเป็น 2 จุดส่ง ไม่ติด "ร้านซ้ำ"
-- ========================================

-- 1. ลบ UNIQUE เฉพาะ customer_code เพื่อให้มีหลายแถว (หลายสาขา) ใช้รหัสลูกค้าเดียวกันได้
--    ชื่อ constraint มักเป็น stores_customer_code_key (จาก UNIQUE on column)
ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_customer_code_key;

-- 2. (ถ้าชื่อ constraint ต่างกันในโปรเจกต์ ให้รันคำสั่งนี้ใน Supabase SQL Editor แทน)
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'public.stores'::regclass AND contype = 'u';
-- แล้ว DROP CONSTRAINT ตามชื่อที่ได้

-- 3. สร้าง unique แบบรวมรหัส+สาขา เพื่อไม่ให้มีร้าน "รหัสเดียวกัน+สาขาเดียวกัน" ซ้ำ (เลือกใช้ได้)
--    ถ้าไม่มีคอลัมน์ branch ให้ข้ามขั้นนี้ หรือเพิ่มคอลัมน์ branch ก่อน
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'branch'
  ) THEN
    -- ไม่บังคับ unique เพื่อให้ยืดหยุ่น: รหัสเดียวกัน สาขาเดียวกัน ก็ให้สร้างได้หลายที่อยู่ (กรณีพิเศษ)
    -- ถ้าอนาคตต้องการกันซ้ำเฉพาะ (customer_code, branch) ให้ uncomment บรรทัดด้านล่าง:
    -- EXECUTE 'ALTER TABLE public.stores ADD CONSTRAINT stores_customer_code_branch_key UNIQUE (customer_code, COALESCE(branch, ''''))';
    NULL;
  END IF;
END $$;

COMMENT ON TABLE public.stores IS
  'ข้อมูลร้านค้า/ลูกค้า. รหัสลูกค้าเดียวกันสามารถมีหลายรายการได้ (หลายสาขา) โดยระบุ branch หรือที่อยู่ต่างกัน. การจัดทริปยังตรวจสอบไม่ให้ store_id เดียวกันปรากฏซ้ำในทริปเดียวกัน';
