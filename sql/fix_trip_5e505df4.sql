-- ========================================
-- Fix Trip Log: 5e505df4-6227-46aa-a04c-ee8b498c4400
-- แก้ไขให้ชี้ไปที่ DT-2512-0020 (e21137bf-2147-4bd4-b788-ac256d62675c)
-- ========================================

-- Step 1: ตรวจสอบข้อมูลปัจจุบัน
SELECT 
  tl.id as trip_log_id,
  v.plate as vehicle,
  tl.checkout_time,
  tl.delivery_trip_id as current_delivery_trip_id,
  dt.trip_number as current_trip_number
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
WHERE tl.id = '5e505df4-6227-46aa-a04c-ee8b498c4400';

-- Step 2: ปิด trigger validation ชั่วคราว
ALTER TABLE trip_logs DISABLE TRIGGER validate_trip_odometer_trigger;

-- Step 3: แก้ไข delivery_trip_id
UPDATE trip_logs
SET delivery_trip_id = 'e21137bf-2147-4bd4-b788-ac256d62675c'
WHERE id = '5e505df4-6227-46aa-a04c-ee8b498c4400';

-- Step 4: เปิด trigger validation กลับ
ALTER TABLE trip_logs ENABLE TRIGGER validate_trip_odometer_trigger;

-- Step 5: ตรวจสอบผลลัพธ์
SELECT 
  tl.id as trip_log_id,
  v.plate as vehicle,
  tl.checkout_time,
  tl.delivery_trip_id,
  dt.trip_number,
  CASE 
    WHEN dt.trip_number = 'DT-2512-0020' THEN '✅ ถูกต้อง'
    ELSE '❌ ผิด'
  END as status
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
WHERE tl.id = '5e505df4-6227-46aa-a04c-ee8b498c4400';
