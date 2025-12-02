-- ========================================
-- Fix Mismatched Delivery Trip Data
-- แก้ไขข้อมูลทริปที่สลับกัน
-- ========================================
-- ปัญหา: trip_logs อาจจะ link กับ delivery_trip_id ผิด
-- เนื่องจากการเรียงลำดับที่ไม่ถูกต้อง

-- ========================================
-- Step 1: แสดงข้อมูลที่อาจมีปัญหา
-- ========================================
-- ตรวจสอบ trip_logs ที่มี delivery_trip_id
SELECT 
  tl.id as trip_log_id,
  tl.vehicle_id,
  tl.checkout_time,
  tl.checkin_time,
  tl.status as trip_status,
  tl.delivery_trip_id,
  dt.trip_number,
  dt.status as delivery_status,
  dt.sequence_order,
  dt.planned_date,
  v.plate
FROM trip_logs tl
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
WHERE tl.delivery_trip_id IS NOT NULL
  AND tl.checkout_time >= '2025-12-01' -- เฉพาะเดือนธันวาคม
ORDER BY tl.vehicle_id, tl.checkout_time;

-- ========================================
-- Step 2: ตรวจสอบ delivery_trips ที่มีปัญหา
-- ========================================
-- แสดง delivery_trips ที่มีสถานะผิดปกติ
SELECT 
  dt.id,
  dt.trip_number,
  dt.vehicle_id,
  dt.planned_date,
  dt.sequence_order,
  dt.status,
  dt.odometer_start,
  dt.odometer_end,
  v.plate,
  COUNT(tl.id) as trip_log_count
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
LEFT JOIN trip_logs tl ON dt.id = tl.delivery_trip_id
WHERE dt.planned_date >= '2025-12-01' -- เฉพาะเดือนธันวาคม
GROUP BY dt.id, dt.trip_number, dt.vehicle_id, dt.planned_date, dt.sequence_order, dt.status, dt.odometer_start, dt.odometer_end, v.plate
ORDER BY dt.vehicle_id, dt.planned_date, dt.sequence_order;

-- ========================================
-- Step 3: แก้ไขข้อมูลที่ผิดพลาด (Manual Fix)
-- ========================================
-- คุณต้องระบุ ID ที่ถูกต้องตามข้อมูลจริง
-- ตัวอย่าง:

-- กรณี 1: ถ้า trip_log link ผิด delivery_trip
-- UPDATE trip_logs 
-- SET delivery_trip_id = 'correct-delivery-trip-id'
-- WHERE id = 'trip-log-id';

-- กรณี 2: ถ้า delivery_trip มี status ผิด
-- UPDATE delivery_trips
-- SET status = 'planned' -- หรือ 'completed' ตามที่ถูกต้อง
-- WHERE id = 'delivery-trip-id';

-- กรณี 3: ถ้า delivery_trip_stores มี delivery_status ผิด
-- UPDATE delivery_trip_stores
-- SET delivery_status = 'pending', delivered_at = NULL
-- WHERE delivery_trip_id = 'delivery-trip-id';

-- ========================================
-- Step 4: Script อัตโนมัติสำหรับกรณีทั่วไป
-- ========================================
-- แก้ไข delivery_trips ที่ status เป็น 'completed' แต่ไม่มี trip_log ที่ checked_in
DO $$
DECLARE
  trip_record RECORD;
BEGIN
  FOR trip_record IN 
    SELECT dt.id, dt.trip_number
    FROM delivery_trips dt
    LEFT JOIN trip_logs tl ON dt.id = tl.delivery_trip_id AND tl.status = 'checked_in'
    WHERE dt.status = 'completed'
      AND tl.id IS NULL
      AND dt.planned_date >= '2025-12-01'
  LOOP
    RAISE NOTICE 'Resetting delivery trip % (%) to planned', trip_record.trip_number, trip_record.id;
    
    -- Reset delivery trip to planned
    UPDATE delivery_trips
    SET status = 'planned',
        odometer_end = NULL,
        updated_at = NOW()
    WHERE id = trip_record.id;
    
    -- Reset all stores to pending
    UPDATE delivery_trip_stores
    SET delivery_status = 'pending',
        delivered_at = NULL
    WHERE delivery_trip_id = trip_record.id;
  END LOOP;
END $$;

-- ========================================
-- Step 5: ลบ link ที่ผิดพลาดออกจาก trip_logs
-- ========================================
-- ลบ delivery_trip_id จาก trip_logs ที่ link ผิด
-- (trip_log ที่ checked_in แต่ delivery_trip ยัง planned)
DO $$
DECLARE
  trip_log_record RECORD;
BEGIN
  FOR trip_log_record IN 
    SELECT tl.id, tl.delivery_trip_id, dt.trip_number, dt.status
    FROM trip_logs tl
    INNER JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
    WHERE tl.status = 'checked_in'
      AND dt.status = 'planned'
      AND tl.checkout_time >= '2025-12-01'
  LOOP
    RAISE NOTICE 'Unlinking trip_log % from delivery_trip % (status: %)', 
      trip_log_record.id, trip_log_record.trip_number, trip_log_record.status;
    
    -- Remove incorrect link
    UPDATE trip_logs
    SET delivery_trip_id = NULL
    WHERE id = trip_log_record.id;
  END LOOP;
END $$;

-- ========================================
-- Step 6: Verify ผลลัพธ์
-- ========================================
-- ตรวจสอบว่าข้อมูลถูกต้องแล้ว
SELECT 
  'Summary' as report_type,
  COUNT(*) FILTER (WHERE dt.status = 'planned') as planned_trips,
  COUNT(*) FILTER (WHERE dt.status = 'in_progress') as in_progress_trips,
  COUNT(*) FILTER (WHERE dt.status = 'completed') as completed_trips,
  COUNT(*) FILTER (WHERE dt.status = 'cancelled') as cancelled_trips
FROM delivery_trips dt
WHERE dt.planned_date >= '2025-12-01';

-- แสดงทริปที่ยังมีปัญหา (ถ้ามี)
SELECT 
  'Potential Issues' as report_type,
  dt.trip_number,
  dt.status as delivery_status,
  dt.sequence_order,
  v.plate,
  COUNT(tl.id) FILTER (WHERE tl.status = 'checked_in') as completed_trip_logs,
  COUNT(tl.id) FILTER (WHERE tl.status = 'checked_out') as active_trip_logs
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
LEFT JOIN trip_logs tl ON dt.id = tl.delivery_trip_id
WHERE dt.planned_date >= '2025-12-01'
GROUP BY dt.id, dt.trip_number, dt.status, dt.sequence_order, v.plate
HAVING 
  (dt.status = 'completed' AND COUNT(tl.id) FILTER (WHERE tl.status = 'checked_in') = 0)
  OR (dt.status = 'planned' AND COUNT(tl.id) FILTER (WHERE tl.status = 'checked_in') > 0)
ORDER BY dt.sequence_order;

-- ========================================
-- คำแนะนำการใช้งาน:
-- ========================================
-- 1. รัน Step 1-2 เพื่อดูข้อมูลปัจจุบัน
-- 2. รัน Step 4-5 เพื่อแก้ไขอัตโนมัติ
-- 3. รัน Step 6 เพื่อตรวจสอบผลลัพธ์
-- 4. ถ้ายังมีปัญหา ใช้ Step 3 แก้ไข manual โดยระบุ ID ที่ถูกต้อง

