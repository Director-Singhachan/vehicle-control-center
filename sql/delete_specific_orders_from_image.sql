-- ========================================
-- Delete Specific Orders (Requested by User)
-- ลบรายการออเดอร์ตามภาพที่ผู้ใช้แจ้ง
-- ========================================

BEGIN;

-- 1. ตรวจสอบข้อมูลก่อนลบ (Optional - uncomment to check)
-- SELECT * FROM public.orders 
-- WHERE order_number IN ('I0260118001', 'I0260115001', 'I0260112001');

-- 2. ดำเนินการลบ
-- การลบ orders จะลบ order_items และ order_status_history ที่เกี่ยวข้องโดยอัตโนมัติ (CASCADE)
DELETE FROM public.orders
WHERE order_number IN (
    'I0260118001',
    'I0260115001',
    'I0260112001'
);

-- 3. ตรวจสอบผลลัพธ์
DO $$
DECLARE
    deleted_count INT;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % orders successfully.', deleted_count;
END $$;

COMMIT;
