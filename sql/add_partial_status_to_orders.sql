-- ============================================================
-- Add 'partial' status to orders table CHECK constraint
-- ============================================================
-- Migration: เพิ่ม status 'partial' เข้าไปใน CHECK constraint ของตาราง orders
-- เพื่อรองรับออเดอร์ที่ส่งบางส่วนแล้ว
-- ============================================================

-- 1. หาชื่อ constraint ที่มีอยู่
-- ============================================================
-- รันส่วนนี้เพื่อดูชื่อ constraint ก่อน (ถ้าต้องการ)
-- ============================================================
/*
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
*/

-- 2. Drop constraint เก่า (ถ้ามี)
-- ============================================================
-- ลบ constraint เก่าที่จำกัดค่า status
-- ============================================================
DO $$
DECLARE
    v_constraint_name text;
BEGIN
    -- หาชื่อ constraint ที่เกี่ยวกับ status
    SELECT conname INTO v_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
        RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
    ELSE
        RAISE NOTICE 'No status constraint found, skipping drop';
    END IF;
END $$;

-- 3. สร้าง constraint ใหม่ที่รวม 'partial'
-- ============================================================
-- เพิ่ม 'partial' เข้าไปในรายการ status ที่อนุญาต
-- ============================================================
ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check 
    CHECK (status IN (
        'pending',        -- รออนุมัติ
        'confirmed',      -- ยืนยันแล้ว รอจัดทริป
        'partial',        -- ส่งบางส่วนแล้ว (ยังมีสินค้าค้างส่ง)
        'assigned',       -- จัดทริปแล้ว
        'in_delivery',    -- กำลังจัดส่ง
        'delivered',      -- ส่งแล้ว
        'cancelled'       -- ยกเลิก
    ));

-- ============================================================
-- หมายเหตุ:
-- ============================================================
-- 1. Script นี้จะ drop constraint เก่าและสร้างใหม่ที่รวม 'partial'
-- 2. ถ้ามี constraint ชื่ออื่นที่ไม่ใช่ 'orders_status_check' 
--    จะ drop constraint นั้นแทน
-- 3. หลังรัน script นี้แล้ว ออเดอร์สามารถมี status = 'partial' ได้
-- ============================================================
