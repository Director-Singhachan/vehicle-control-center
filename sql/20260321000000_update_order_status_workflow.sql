-- ============================================================
-- Migration: Update Order Status Workflow (v2 - Robust)
-- ============================================================
-- 1. เพิ่ม status 'awaiting_confirmation' เป็นสถานะเริ่มต้นเมื่อสร้างออเดอร์
-- 2. เพิ่ม status 'awaiting_dispatch' เป็นสถานะเมื่อยืนยันออเดอร์แล้ว
-- 3. รวม status อื่นๆ ที่ใช้ในระบบ (legacy และ documentation)
-- ============================================================

-- Drop constraint เก่าแบบระบุชื่อโดยตรง
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- ค้นหาและลบ constraint อื่นๆ ที่อาจจะเกี่ยวกับ status (ป้องกันชื่อซ้ำซ้อน)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.orders'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

-- สร้าง constraint ใหม่ที่ครอบคลุมทุกสถานะที่จำเป็น
ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check 
    CHECK (status IN (
        'awaiting_confirmation', -- สร้างออเดอร์แล้ว รอฝ่ายขาย/แอดมินยืนยัน (NEW)
        'awaiting_dispatch',     -- ยืนยันแล้ว รอจัดทริปขนส่ง (NEW)
        'pending',               -- รออนุมัติ (Legacy)
        'confirmed',             -- ยืนยันแล้ว (Legacy - เทียบเท่า awaiting_dispatch)
        'sent_to_warehouse',     -- ส่งให้คลังแล้ว (Docs)
        'queue_ready',           -- คลังจัดคิวเสร็จแล้ว (Docs)
        'billed',                -- ออกบิลแล้ว (Docs)
        'partial',               -- ส่งบางส่วนแล้ว
        'assigned',              -- จัดทริปแล้ว
        'in_delivery',           -- กำลังจัดส่ง
        'delivered',             -- ส่งเสร็จแล้ว
        'cancelled',             -- ยกเลิก
        'rejected'               -- ไม่อนุมัติ
    ));

-- หมายเหตุ: 
-- 1. 'awaiting_confirmation' คือสถานะแรกสุด (Create)
-- 2. เมื่อ Confirm ในหน้า ConfirmOrderView -> จะเปลี่ยนเป็น 'awaiting_dispatch'
-- 3. หน้ารอจัดทริป (PendingOrdersView) จะแสดง 'awaiting_dispatch', 'confirmed', 'partial', 'assigned'
