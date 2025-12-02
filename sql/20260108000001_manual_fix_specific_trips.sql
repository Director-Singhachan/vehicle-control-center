    -- ========================================
    -- Manual Fix for Specific Trips (DT-2512-0009 and DT-2512-0010)
    -- แก้ไขข้อมูลเฉพาะทริป DT-2512-0009 และ DT-2512-0010
    -- ========================================

    -- ========================================
    -- Step 1: ดูข้อมูลปัจจุบันของทริปที่มีปัญหา
    -- ========================================
    SELECT 
    'DT-2512-0009 Current State' as info,
    dt.id,
    dt.trip_number,
    dt.status,
    dt.sequence_order,
    dt.odometer_start,
    dt.odometer_end,
    v.plate,
    (SELECT COUNT(*) FROM trip_logs WHERE delivery_trip_id = dt.id) as linked_trip_logs
    FROM delivery_trips dt
    LEFT JOIN vehicles v ON dt.vehicle_id = v.id
    WHERE dt.trip_number = 'DT-2512-0009';

    SELECT 
    'DT-2512-0010 Current State' as info,
    dt.id,
    dt.trip_number,
    dt.status,
    dt.sequence_order,
    dt.odometer_start,
    dt.odometer_end,
    v.plate,
    (SELECT COUNT(*) FROM trip_logs WHERE delivery_trip_id = dt.id) as linked_trip_logs
    FROM delivery_trips dt
    LEFT JOIN vehicles v ON dt.vehicle_id = v.id
    WHERE dt.trip_number = 'DT-2512-0010';

    -- ========================================
    -- Step 2: ดู trip_logs ที่เกี่ยวข้อง
    -- ========================================
    SELECT 
    'Trip Logs for These Trips' as info,
    tl.id as trip_log_id,
    tl.checkout_time,
    tl.checkin_time,
    tl.status,
    tl.odometer_start,
    tl.odometer_end,
    tl.delivery_trip_id,
    dt.trip_number
    FROM trip_logs tl
    LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
    WHERE dt.trip_number IN ('DT-2512-0009', 'DT-2512-0010')
    ORDER BY tl.checkout_time;

    -- ========================================
    -- Step 3: แก้ไขข้อมูล
    -- ========================================
    -- คุณต้องแทนที่ ID ด้านล่างด้วย ID จริงจากผลลัพธ์ของ Step 1-2

    -- 3.1: หา ID ของทริปทั้งสอง
    DO $$
    DECLARE
    trip_0009_id UUID;
    trip_0010_id UUID;
    trip_log_id UUID;
    vehicle_id_var UUID;
    BEGIN
    -- หา ID ของ DT-2512-0009
    SELECT id, vehicle_id INTO trip_0009_id, vehicle_id_var
    FROM delivery_trips
    WHERE trip_number = 'DT-2512-0009';
    
    -- หา ID ของ DT-2512-0010
    SELECT id INTO trip_0010_id
    FROM delivery_trips
    WHERE trip_number = 'DT-2512-0010';
    
    IF trip_0009_id IS NULL OR trip_0010_id IS NULL THEN
        RAISE EXCEPTION 'Cannot find one or both trips';
    END IF;
    
    RAISE NOTICE 'DT-2512-0009 ID: %', trip_0009_id;
    RAISE NOTICE 'DT-2512-0010 ID: %', trip_0010_id;
    
    -- 3.2: หา trip_log ที่ควรจะเป็นของ DT-2512-0009 (ทริปแรกที่ checked_in)
    SELECT tl.id INTO trip_log_id
    FROM trip_logs tl
    WHERE tl.vehicle_id = vehicle_id_var
        AND tl.status = 'checked_in'
        AND tl.delivery_trip_id = trip_0010_id -- ปัจจุบัน link ผิดไปที่ 0010
    ORDER BY tl.checkout_time
    LIMIT 1;
    
    IF trip_log_id IS NOT NULL THEN
        RAISE NOTICE 'Found trip_log to fix: %', trip_log_id;
        
        -- 3.3: แก้ไข trip_log ให้ link กับ DT-2512-0009
        UPDATE trip_logs
        SET delivery_trip_id = trip_0009_id
        WHERE id = trip_log_id;
        
        RAISE NOTICE 'Updated trip_log % to link with DT-2512-0009', trip_log_id;
        
        -- 3.4: อัปเดต DT-2512-0009 ให้เป็น completed
        UPDATE delivery_trips
        SET status = 'completed',
            odometer_end = (SELECT odometer_end FROM trip_logs WHERE id = trip_log_id),
            updated_at = NOW()
        WHERE id = trip_0009_id;
        
        -- 3.5: อัปเดต stores ของ DT-2512-0009 ให้เป็น delivered
        UPDATE delivery_trip_stores
        SET delivery_status = 'delivered',
            delivered_at = (SELECT checkin_time FROM trip_logs WHERE id = trip_log_id)
        WHERE delivery_trip_id = trip_0009_id;
        
        RAISE NOTICE 'Updated DT-2512-0009 to completed';
        
        -- 3.6: Reset DT-2512-0010 กลับเป็น planned
        UPDATE delivery_trips
        SET status = 'planned',
            odometer_start = NULL,
            odometer_end = NULL,
            updated_at = NOW()
        WHERE id = trip_0010_id;
        
        -- 3.7: Reset stores ของ DT-2512-0010 กลับเป็น pending
        UPDATE delivery_trip_stores
        SET delivery_status = 'pending',
            delivered_at = NULL
        WHERE delivery_trip_id = trip_0010_id;
        
        RAISE NOTICE 'Reset DT-2512-0010 to planned';
    ELSE
        RAISE NOTICE 'No trip_log found to fix - data might already be correct';
    END IF;
    END $$;

    -- ========================================
    -- Step 4: ตรวจสอบผลลัพธ์
    -- ========================================
    SELECT 
    'After Fix - DT-2512-0009' as info,
    dt.trip_number,
    dt.status,
    dt.sequence_order,
    dt.odometer_start,
    dt.odometer_end,
    (SELECT COUNT(*) FROM delivery_trip_stores WHERE delivery_trip_id = dt.id AND delivery_status = 'delivered') as delivered_stores,
    (SELECT COUNT(*) FROM trip_logs WHERE delivery_trip_id = dt.id AND status = 'checked_in') as completed_trip_logs
    FROM delivery_trips dt
    WHERE dt.trip_number = 'DT-2512-0009';

    SELECT 
    'After Fix - DT-2512-0010' as info,
    dt.trip_number,
    dt.status,
    dt.sequence_order,
    dt.odometer_start,
    dt.odometer_end,
    (SELECT COUNT(*) FROM delivery_trip_stores WHERE delivery_trip_id = dt.id AND delivery_status = 'delivered') as delivered_stores,
    (SELECT COUNT(*) FROM trip_logs WHERE delivery_trip_id = dt.id) as linked_trip_logs
    FROM delivery_trips dt
    WHERE dt.trip_number = 'DT-2512-0010';

    -- ========================================
    -- คำแนะนำ:
    -- ========================================
    -- 1. รัน Step 1-2 เพื่อดูข้อมูลปัจจุบัน
    -- 2. รัน Step 3 เพื่อแก้ไขอัตโนมัติ
    -- 3. รัน Step 4 เพื่อตรวจสอบว่าแก้ไขสำเร็จ
    -- 
    -- ผลลัพธ์ที่คาดหวัง:
    -- - DT-2512-0009: status = 'completed', มี trip_log ที่ checked_in
    -- - DT-2512-0010: status = 'planned', ไม่มี trip_log link

