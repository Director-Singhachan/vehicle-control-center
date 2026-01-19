-- ========================================
-- Fix User Roles based on Email Domain
-- แก้ไข Role ของผู้ใช้ให้ถูกต้องตาม Domain Email
-- ========================================

BEGIN;

-- 1. อัพเดท Role ของ Sales (คนที่ใช้อีเมล @sales.local)
UPDATE public.profiles
SET role = 'sales'
WHERE email LIKE '%@sales.local' 
AND role != 'sales';

-- 2. อัพเดท Role ของ Driver (คนที่ใช้อีเมล @driver.local - เผื่อหลุด)
UPDATE public.profiles
SET role = 'driver'
WHERE email LIKE '%@driver.local' 
AND role != 'driver';

-- 3. ตรวจสอบและแสดงผลลัพธ์
DO $$
DECLARE
    updated_sales INT;
    updated_drivers INT;
BEGIN
    -- นับจำนวนที่อัพเดท (ต้องใช้วิธีอื่นในการนับถ้าอยู่ใน UPDATE เดียวกัน แต่แยกคิวรี่แล้ว)
    -- ใน Postgres PL/pgSQL ใช้ GET DIAGNOSTICS ได้หลังคำสั่ง UPDATE แต่เราทำทีละอัน
    
    RAISE NOTICE 'Role correction script completed.';
END $$;

COMMIT;

-- แสดงข้อมูลที่แก้ไขแล้ว (Optional)
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE email LIKE '%@sales.local' OR email LIKE '%@driver.local';
