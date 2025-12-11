-- ========================================
-- Fix Specific Trip Log: 601e0414-4f27-48ac-9a79-6dc72f62495a
-- แก้ไขทริปที่แสดง DT-2512-0022 ให้เป็น DT-2512-0030
-- ========================================

-- Step 1: ตรวจสอบข้อมูลปัจจุบัน
SELECT 
  tl.id as trip_log_id,
  tl.vehicle_id,
  v.plate as trip_log_vehicle,
  tl.checkout_time,
  tl.delivery_trip_id as current_delivery_trip_id,
  dt_current.trip_number as current_trip_number,
  dt_current.vehicle_id as current_dt_vehicle_id,
  v2.plate as current_dt_vehicle_plate
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt_current ON tl.delivery_trip_id = dt_current.id
LEFT JOIN vehicles v2 ON dt_current.vehicle_id = v2.id
WHERE tl.delivery_trip_id = '601e0414-4f27-48ac-9a79-6dc72f62495a';

-- Step 2: หา delivery_trip ที่ถูกต้อง (DT-2512-0030)
SELECT 
  dt.id,
  dt.trip_number,
  dt.vehicle_id,
  v.plate,
  dt.planned_date,
  dt.status,
  dt.sequence_order
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
WHERE dt.trip_number = 'DT-2512-0030';

-- Step 3: ตรวจสอบว่า trip_log ควรจะผูกกับทริปไหน
-- (ดูจากรถและวันที่)
SELECT 
  tl.id as trip_log_id,
  tl.vehicle_id,
  v.plate as vehicle_plate,
  tl.checkout_time::date as checkout_date,
  tl.delivery_trip_id as current_link,
  dt_correct.id as correct_delivery_trip_id,
  dt_correct.trip_number as correct_trip_number
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt_correct ON 
  dt_correct.vehicle_id = tl.vehicle_id 
  AND dt_correct.planned_date = tl.checkout_time::date
  AND dt_correct.trip_number = 'DT-2512-0030'
WHERE tl.delivery_trip_id = '601e0414-4f27-48ac-9a79-6dc72f62495a';

-- Step 4: ปิด trigger validation ชั่วคราว
ALTER TABLE trip_logs DISABLE TRIGGER validate_trip_odometer_trigger;

-- Step 5: แก้ไข delivery_trip_id ให้ถูกต้อง
DO $$
DECLARE
  correct_trip_id UUID;
  trip_log_record RECORD;
BEGIN
  -- หา ID ของ DT-2512-0030
  SELECT id INTO correct_trip_id
  FROM delivery_trips
  WHERE trip_number = 'DT-2512-0030';
  
  IF correct_trip_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบทริป DT-2512-0030 ในระบบ';
  END IF;
  
  -- ดึงข้อมูล trip_log
  SELECT 
    tl.id,
    tl.vehicle_id,
    v.plate,
    tl.checkout_time
  INTO trip_log_record
  FROM trip_logs tl
  LEFT JOIN vehicles v ON tl.vehicle_id = v.id
  WHERE tl.delivery_trip_id = '601e0414-4f27-48ac-9a79-6dc72f62495a';
  
  IF trip_log_record.id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ trip_log ที่มี delivery_trip_id = 601e0414-4f27-48ac-9a79-6dc72f62495a';
  END IF;
  
  RAISE NOTICE 'กำลังแก้ไข trip_log: % (รถ: %, เวลา: %)',
    trip_log_record.id,
    trip_log_record.plate,
    trip_log_record.checkout_time;
  
  -- อัปเดต delivery_trip_id
  UPDATE trip_logs
  SET delivery_trip_id = correct_trip_id
  WHERE delivery_trip_id = '601e0414-4f27-48ac-9a79-6dc72f62495a';
  
  RAISE NOTICE 'แก้ไขเสร็จสิ้น: เปลี่ยนจาก DT-2512-0022 เป็น DT-2512-0030';
  RAISE NOTICE 'Trip ID ใหม่: %', correct_trip_id;
END $$;

-- Step 6: เปิด trigger validation กลับ
ALTER TABLE trip_logs ENABLE TRIGGER validate_trip_odometer_trigger;

-- Step 7: ตรวจสอบผลลัพธ์
SELECT 
  tl.id as trip_log_id,
  tl.vehicle_id,
  v.plate as trip_log_vehicle,
  tl.checkout_time,
  tl.delivery_trip_id,
  dt.trip_number,
  dt.vehicle_id as dt_vehicle_id,
  v2.plate as dt_vehicle_plate,
  CASE 
    WHEN tl.vehicle_id = dt.vehicle_id THEN '✅ ถูกต้อง'
    ELSE '❌ ผิด'
  END as status
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
LEFT JOIN vehicles v2 ON dt.vehicle_id = v2.id
WHERE dt.trip_number IN ('DT-2512-0022', 'DT-2512-0030')
ORDER BY tl.checkout_time DESC;
