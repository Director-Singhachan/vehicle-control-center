-- ========================================
-- Update ORD-2601-0001 and ORD-2601-0002 to confirmed status
-- ========================================
-- แก้ไขออเดอร์ที่มี status = 'pending' ให้เป็น 'confirmed' 
-- เพื่อให้แสดงในหน้า "ออเดอร์ที่รอจัดทริป"

DO $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'กำลังอัปเดตออเดอร์เป็น confirmed status...';
    RAISE NOTICE '========================================';

    -- บันทึกประวัติการเปลี่ยนแปลงก่อน
    INSERT INTO public.order_status_history (order_id, from_status, to_status, reason, created_at)
    SELECT 
        id,
        status,
        'confirmed',
        'Updated to confirmed - ready for trip assignment after trip deletion',
        now()
    FROM public.orders
    WHERE order_number IN ('ORD-2601-0001', 'ORD-2601-0002')
      AND status = 'pending'
      AND delivery_trip_id IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- อัปเดต status
    UPDATE public.orders
    SET 
        status = 'confirmed',
        updated_at = now()
    WHERE order_number IN ('ORD-2601-0001', 'ORD-2601-0002')
      AND status = 'pending'
      AND delivery_trip_id IS NULL;

    RAISE NOTICE 'อัปเดตออเดอร์ % รายการเป็น confirmed', v_updated_count;
    RAISE NOTICE '========================================';

    IF v_updated_count = 0 THEN
        RAISE NOTICE 'ไม่พบออเดอร์ที่ต้องอัปเดต (อาจจะอัปเดตไปแล้ว)';
    END IF;
END $$;

-- ตรวจสอบผลลัพธ์
SELECT 
    order_number,
    status,
    delivery_trip_id,
    CASE 
        WHEN status = 'confirmed' AND delivery_trip_id IS NULL 
            THEN '✅ จะแสดงใน pending_orders'
        ELSE '❌ ไม่แสดงใน pending_orders'
    END as will_appear
FROM public.orders
WHERE order_number IN ('ORD-2601-0001', 'ORD-2601-0002')
ORDER BY order_number;

-- เช็คว่าปรากฏใน pending_orders view หรือไม่
SELECT 
    order_number,
    customer_name,
    status,
    order_date,
    total_amount
FROM public.pending_orders
WHERE order_number IN ('ORD-2601-0001', 'ORD-2601-0002')
ORDER BY order_number;
