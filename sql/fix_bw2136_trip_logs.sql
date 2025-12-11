-- ========================================
-- Fix Multiple Trip Logs for Vehicle บว 2136
-- แก้ไข trip logs ที่ผูกกับ delivery_trip ผิด
-- ========================================

-- Step 1: ตรวจสอบข้อมูลปัจจุบันของ trip logs ทั้งหมดที่มีปัญหา
SELECT 
  tl.id as trip_log_id,
  tl.vehicle_id,
  v.plate as trip_log_vehicle,
  tl.checkout_time,
  tl.delivery_trip_id,
  dt.trip_number as current_trip_number,
  dt.vehicle_id as dt_vehicle_id,
  v2.plate as dt_vehicle_plate,
  CASE 
    WHEN tl.vehicle_id = dt.vehicle_id THEN '✅ รถตรงกัน'
    ELSE '❌ รถไม่ตรงกัน'
  END as vehicle_match
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
LEFT JOIN vehicles v2 ON dt.vehicle_id = v2.id
WHERE v.plate = 'บว 2136'
  AND tl.checkout_time::date = '2025-12-09'
ORDER BY tl.checkout_time;

-- Step 2: แสดง delivery trips ที่มีอยู่สำหรับรถ บว 2136 วันที่ 2025-12-09
SELECT 
  dt.id,
  dt.trip_number,
  dt.planned_date,
  dt.status,
  dt.sequence_order,
  v.plate,
  (SELECT COUNT(*) FROM trip_logs WHERE delivery_trip_id = dt.id) as linked_trip_logs
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
WHERE v.plate = 'บว 2136'
  AND dt.planned_date = '2025-12-09'
ORDER BY dt.sequence_order;

-- Step 3: ปิด trigger validation ชั่วคราว
ALTER TABLE trip_logs DISABLE TRIGGER validate_trip_odometer_trigger;

-- Step 4: แก้ไข trip logs ให้ชี้ไปที่ delivery_trip ที่ถูกต้อง
-- เฉพาะ trip logs ที่ควรจะเป็น DT-2512-0022 เท่านั้น
-- (ไม่แตะ DT-2512-0030 ที่แก้ไขไปแล้ว)
DO $$
DECLARE
  dt_0022_id UUID;
  dt_0030_id UUID;
  vehicle_bw2136_id UUID;
  trip_log_record RECORD;
  fixed_count INTEGER := 0;
BEGIN
  -- หา vehicle_id ของรถ บว 2136
  SELECT id INTO vehicle_bw2136_id
  FROM vehicles
  WHERE plate = 'บว 2136';
  
  IF vehicle_bw2136_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบรถทะเบียน บว 2136';
  END IF;
  
  -- หา delivery_trip_id ของ DT-2512-0022
  SELECT id INTO dt_0022_id
  FROM delivery_trips
  WHERE trip_number = 'DT-2512-0022'
    AND vehicle_id = vehicle_bw2136_id;
  
  -- หา delivery_trip_id ของ DT-2512-0030 (เพื่อไม่แตะ)
  SELECT id INTO dt_0030_id
  FROM delivery_trips
  WHERE trip_number = 'DT-2512-0030'
    AND vehicle_id = vehicle_bw2136_id;
  
  IF dt_0022_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบทริป DT-2512-0022 สำหรับรถ บว 2136';
  END IF;
  
  RAISE NOTICE 'พบ DT-2512-0022 ID: %', dt_0022_id;
  IF dt_0030_id IS NOT NULL THEN
    RAISE NOTICE 'พบ DT-2512-0030 ID: % (จะไม่แตะ)', dt_0030_id;
  END IF;
  
  -- วนลูปแก้ไข trip logs ที่ควรเป็น DT-2512-0022 เท่านั้น
  -- ยกเว้น trip logs ที่เป็น DT-2512-0030 อยู่แล้ว
  FOR trip_log_record IN
    SELECT 
      tl.id,
      tl.checkout_time,
      tl.delivery_trip_id,
      dt.trip_number as current_trip_number
    FROM trip_logs tl
    LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
    WHERE tl.vehicle_id = vehicle_bw2136_id
      AND tl.checkout_time::date = '2025-12-09'
      AND (tl.delivery_trip_id IS NULL 
           OR (tl.delivery_trip_id != dt_0022_id AND tl.delivery_trip_id != dt_0030_id))
  LOOP
    RAISE NOTICE 'แก้ไข trip_log: % (เวลา: %, ทริปเดิม: %)',
      trip_log_record.id,
      trip_log_record.checkout_time,
      trip_log_record.current_trip_number;
    
    -- อัปเดตให้ชี้ไปที่ DT-2512-0022
    UPDATE trip_logs
    SET delivery_trip_id = dt_0022_id
    WHERE id = trip_log_record.id;
    
    fixed_count := fixed_count + 1;
  END LOOP;
  
  RAISE NOTICE 'แก้ไขเสร็จสิ้น: % รายการ', fixed_count;
  RAISE NOTICE 'Trip logs ที่เป็น DT-2512-0030 อยู่แล้วจะไม่ถูกแตะต้อง';
END $$;

-- Step 5: เปิด trigger validation กลับ
ALTER TABLE trip_logs ENABLE TRIGGER validate_trip_odometer_trigger;

-- Step 6: ตรวจสอบผลลัพธ์
SELECT 
  tl.id as trip_log_id,
  v.plate as trip_log_vehicle,
  tl.checkout_time,
  dt.trip_number,
  dt.vehicle_id as dt_vehicle_id,
  v2.plate as dt_vehicle_plate,
  CASE 
    WHEN tl.vehicle_id = dt.vehicle_id AND dt.trip_number = 'DT-2512-0022' THEN '✅ ถูกต้อง'
    WHEN tl.vehicle_id = dt.vehicle_id THEN '⚠️ รถถูกต้องแต่ทริปอาจผิด'
    ELSE '❌ ผิด'
  END as status
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
LEFT JOIN vehicles v2 ON dt.vehicle_id = v2.id
WHERE v.plate = 'บว 2136'
  AND tl.checkout_time::date = '2025-12-09'
ORDER BY tl.checkout_time;

-- Step 7: สรุปจำนวน trip logs ที่ผูกกับแต่ละ delivery trip
SELECT 
  dt.trip_number,
  dt.planned_date,
  v.plate,
  COUNT(tl.id) as trip_log_count
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
LEFT JOIN trip_logs tl ON tl.delivery_trip_id = dt.id
WHERE v.plate = 'บว 2136'
  AND dt.planned_date = '2025-12-09'
GROUP BY dt.id, dt.trip_number, dt.planned_date, v.plate
ORDER BY dt.trip_number;
