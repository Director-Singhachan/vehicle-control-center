-- ============================================================
-- SQL Script: Reset All Tickets Data and Sequences
-- ============================================================
-- คำอธิบาย: ลบข้อมูลการแจ้งซ่อมทั้งหมดและรีเซ็ต sequence ให้เริ่มจาก 0 ใหม่
-- หมายเหตุ: การลบข้อมูลจะลบแบบ CASCADE ดังนั้นจะลบข้อมูลที่เกี่ยวข้องทั้งหมด
-- ============================================================

BEGIN;

-- ============================================================
-- Step 1: ลบข้อมูลจากตารางที่เกี่ยวข้อง (เรียงตาม Foreign Key)
-- ============================================================

-- ลบ ticket_costs (reference tickets)
-- หมายเหตุ: ticket_costs.id ใช้ UUID ไม่ใช่ serial ดังนั้นไม่ต้อง reset sequence
DELETE FROM public.ticket_costs;

-- ลบ ticket_approvals (reference tickets)
-- หมายเหตุ: ticket_approvals.id ใช้ UUID ไม่ใช่ serial ดังนั้นไม่ต้อง reset sequence
DELETE FROM public.ticket_approvals;

-- ลบ tickets (ตารางหลัก)
DELETE FROM public.tickets;

-- ============================================================
-- Step 2: Reset sequence ของ tickets.id (bigserial)
-- ============================================================
-- Reset sequence ให้เริ่มจาก 1 ใหม่ (next value จะเป็น 1)
DO $$
DECLARE
    seq_name text;
BEGIN
    seq_name := pg_get_serial_sequence('public.tickets', 'id');
    IF seq_name IS NOT NULL THEN
        EXECUTE format('SELECT setval(%L, 1, false)', seq_name);
        RAISE NOTICE 'Reset sequence: % to 1', seq_name;
    ELSE
        RAISE NOTICE 'Sequence not found for tickets.id';
    END IF;
END $$;

-- ============================================================
-- Step 3: ลบ sequences สำหรับ Ticket Number Generation
-- ============================================================
-- ลบ sequences ทั้งหมดที่มีชื่อขึ้นต้นด้วย ticket_seq_ (เช่น ticket_seq_2501, ticket_seq_2502)
DO $$
DECLARE
    seq_name text;
BEGIN
    -- หาและลบ sequences ทั้งหมดที่ขึ้นต้นด้วย ticket_seq_
    FOR seq_name IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public' 
        AND sequence_name LIKE 'ticket_seq_%'
    LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(seq_name) || ' CASCADE';
        RAISE NOTICE 'Dropped sequence: %', seq_name;
    END LOOP;
END $$;

-- ============================================================
-- Step 4: ลบ audit logs ที่เกี่ยวข้องกับ tickets (ถ้ามี)
-- ============================================================
DELETE FROM public.audit_logs 
WHERE table_name IN ('tickets', 'ticket_approvals', 'ticket_costs');

-- ============================================================
-- Step 5: ลบ notification_events ที่เกี่ยวข้องกับ tickets
-- ============================================================
-- ลบ notification events ที่เป็น ticket_pdf_for_approval หรือ ticket_created
DELETE FROM public.notification_events 
WHERE event_type IN ('ticket_pdf_for_approval', 'ticket_created', 'ticket_closed')
   OR payload->>'ticket_id' IS NOT NULL;

COMMIT;

-- ============================================================
-- สรุปผลการทำงาน
-- ============================================================
SELECT 
    'tickets' as table_name,
    COUNT(*) as remaining_count
FROM public.tickets
UNION ALL
SELECT 
    'ticket_approvals' as table_name,
    COUNT(*) as remaining_count
FROM public.ticket_approvals
UNION ALL
SELECT 
    'ticket_costs' as table_name,
    COUNT(*) as remaining_count
FROM public.ticket_costs;

-- ============================================================
-- หมายเหตุเพิ่มเติมเกี่ยวกับ Storage Files
-- ============================================================
-- ไฟล์ PDF ที่เก็บไว้ใน Supabase Storage ต้องลบผ่าน:
-- 
-- วิธีที่ 1: ผ่าน Supabase Dashboard
--   1. ไปที่ Storage > ticket-attachments
--   2. ลบโฟลเดอร์ต่อไปนี้:
--      - ticket-pdfs/
--      - signed-tickets/
--      - pending-pdfs/
--
-- วิธีที่ 2: ใช้ Supabase Storage API หรือ Edge Function
--   (ต้องเขียนโค้ดเพิ่มเติม)
-- ============================================================

