-- ========================================
-- Fix Trip Log Delivery Trip Mismatch
-- แก้ไขปัญหา trip_logs ที่ link กับ delivery_trip ผิดรถ
-- ========================================

-- Step 1: ตรวจสอบ trip_logs ที่มี delivery_trip_id ผิดรถ
SELECT 
  tl.id as trip_log_id,
  tl.vehicle_id as trip_log_vehicle_id,
  v1.plate as trip_log_vehicle_plate,
  tl.checkout_time,
  tl.status as trip_log_status,
  tl.delivery_trip_id,
  dt.trip_number,
  dt.vehicle_id as delivery_trip_vehicle_id,
  v2.plate as delivery_trip_vehicle_plate,
  dt.status as delivery_trip_status
FROM trip_logs tl
LEFT JOIN vehicles v1 ON tl.vehicle_id = v1.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
LEFT JOIN vehicles v2 ON dt.vehicle_id = v2.id
WHERE tl.delivery_trip_id IS NOT NULL
  AND tl.vehicle_id != dt.vehicle_id  -- ต่างรถกัน!
ORDER BY tl.checkout_time DESC;

-- Step 2: แสดงจำนวนรายการที่มีปัญหา
SELECT 
  COUNT(*) as mismatched_count,
  COUNT(DISTINCT tl.vehicle_id) as affected_vehicles
FROM trip_logs tl
INNER JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
WHERE tl.vehicle_id != dt.vehicle_id;

-- Step 3: ปิด trigger validation ชั่วคราว
-- เพื่อให้สามารถแก้ไข delivery_trip_id ได้โดยไม่ติด validation
ALTER TABLE trip_logs DISABLE TRIGGER validate_trip_odometer_trigger;

-- Step 4: แก้ไขโดยลบ delivery_trip_id ที่ผิดออก
-- (ให้ระบบหา delivery_trip ที่ถูกต้องใหม่ในครั้งถัดไป)
DO $$
DECLARE
  mismatch_record RECORD;
  correct_trip_id UUID;
BEGIN
  FOR mismatch_record IN 
    SELECT 
      tl.id as trip_log_id,
      tl.vehicle_id,
      tl.checkout_time,
      tl.delivery_trip_id as wrong_delivery_trip_id,
      dt.trip_number as wrong_trip_number,
      v1.plate as trip_log_plate,
      v2.plate as wrong_delivery_plate
    FROM trip_logs tl
    INNER JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
    LEFT JOIN vehicles v1 ON tl.vehicle_id = v1.id
    LEFT JOIN vehicles v2 ON dt.vehicle_id = v2.id
    WHERE tl.vehicle_id != dt.vehicle_id
    ORDER BY tl.checkout_time DESC
  LOOP
    RAISE NOTICE 'Found mismatch: trip_log % (vehicle %) linked to delivery_trip % (vehicle %)',
      mismatch_record.trip_log_id,
      mismatch_record.trip_log_plate,
      mismatch_record.wrong_trip_number,
      mismatch_record.wrong_delivery_plate;
    
    -- Try to find the correct delivery_trip for this vehicle and time
    SELECT id INTO correct_trip_id
    FROM delivery_trips
    WHERE vehicle_id = mismatch_record.vehicle_id
      AND planned_date::date = mismatch_record.checkout_time::date
      AND status IN ('planned', 'in_progress', 'completed')
    ORDER BY 
      CASE 
        WHEN status = 'in_progress' THEN 1
        WHEN status = 'planned' THEN 2
        WHEN status = 'completed' THEN 3
        ELSE 4
      END,
      sequence_order ASC
    LIMIT 1;
    
    IF correct_trip_id IS NOT NULL THEN
      -- Found a matching trip, update the link
      UPDATE trip_logs
      SET delivery_trip_id = correct_trip_id
      WHERE id = mismatch_record.trip_log_id;
      
      RAISE NOTICE '  → Fixed: Linked to correct delivery_trip %', correct_trip_id;
    ELSE
      -- No matching trip found, remove the incorrect link
      UPDATE trip_logs
      SET delivery_trip_id = NULL
      WHERE id = mismatch_record.trip_log_id;
      
      RAISE NOTICE '  → Removed incorrect link (no matching trip found)';
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed fixing trip_log delivery_trip mismatches';
END $$;

-- Step 5: เปิด trigger validation กลับ
ALTER TABLE trip_logs ENABLE TRIGGER validate_trip_odometer_trigger;

-- Step 6: ตรวจสอบผลลัพธ์หลังแก้ไข
SELECT 
  'After Fix' as status,
  COUNT(*) as mismatched_count
FROM trip_logs tl
INNER JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
WHERE tl.vehicle_id != dt.vehicle_id;

-- Step 7: แสดง trip_logs ที่ยังไม่มี delivery_trip_id (อาจต้องการ link)
SELECT 
  tl.id,
  v.plate,
  tl.checkout_time,
  tl.status,
  tl.destination
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
WHERE tl.delivery_trip_id IS NULL
  AND tl.checkout_time >= CURRENT_DATE - INTERVAL '30 days'
  AND tl.status = 'checked_in'
ORDER BY tl.checkout_time DESC
LIMIT 20;

-- Step 8: แสดงสรุปข้อมูล trip_logs และ delivery_trips
SELECT 
  v.plate,
  COUNT(DISTINCT tl.id) FILTER (WHERE tl.delivery_trip_id IS NOT NULL) as trips_with_delivery,
  COUNT(DISTINCT tl.id) FILTER (WHERE tl.delivery_trip_id IS NULL) as trips_without_delivery,
  COUNT(DISTINCT dt.id) as total_delivery_trips
FROM vehicles v
LEFT JOIN trip_logs tl ON tl.vehicle_id = v.id AND tl.checkout_time >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN delivery_trips dt ON dt.vehicle_id = v.id AND dt.planned_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY v.id, v.plate
ORDER BY v.plate;
