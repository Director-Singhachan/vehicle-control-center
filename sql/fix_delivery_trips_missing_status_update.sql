-- ========================================
-- Fix Delivery Trips Missing Status Update
-- แก้ไข delivery trips ที่ยังไม่ได้ถูกอัปเดตสถานะเป็น 'completed'
-- แม้ว่าจะมีการบันทึกการใช้รถ (trip_logs) ที่ check-in แล้ว
-- ========================================

DO $$
DECLARE
  trip_record RECORD;
  trip_log_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting to fix delivery trips with missing status updates...';
  
  -- ค้นหา delivery trips ที่มี status 'planned' หรือ 'in_progress'
  -- และมี trip_logs ที่ check-in แล้วสำหรับ vehicle_id และ planned_date เดียวกัน
  FOR trip_record IN
    SELECT 
      dt.id,
      dt.trip_number,
      dt.vehicle_id,
      dt.driver_id as planned_driver_id,
      dt.planned_date,
      dt.status,
      dt.odometer_start,
      dt.odometer_end,
      v.plate as vehicle_plate
    FROM delivery_trips dt
    INNER JOIN vehicles v ON dt.vehicle_id = v.id
    WHERE dt.status IN ('planned', 'in_progress')
      AND dt.planned_date <= CURRENT_DATE -- เฉพาะทริปที่ผ่านมาแล้วหรือวันนี้
    ORDER BY dt.planned_date DESC, dt.created_at DESC
  LOOP
    -- ค้นหา trip_log ที่ check-in แล้วสำหรับ vehicle_id และ planned_date เดียวกัน
    -- โดยไม่สนใจ driver_id (เพราะคนขับจริงอาจเป็นอีกคน)
    SELECT 
      tl.id,
      tl.driver_id as actual_driver_id,
      tl.odometer_start,
      tl.odometer_end,
      tl.checkout_time,
      tl.checkin_time,
      tl.status,
      tl.delivery_trip_id
    INTO trip_log_record
    FROM trip_logs tl
    WHERE tl.vehicle_id = trip_record.vehicle_id
      AND tl.status = 'checked_in'
      AND DATE(tl.checkout_time) = trip_record.planned_date
      AND (tl.delivery_trip_id IS NULL OR tl.delivery_trip_id = trip_record.id)
    ORDER BY tl.checkin_time DESC
    LIMIT 1;
    
    -- ถ้าพบ trip_log ที่ check-in แล้ว ให้อัปเดต delivery trip
    IF trip_log_record.id IS NOT NULL THEN
      RAISE NOTICE 'Found delivery trip % (status: %) with completed trip_log %', 
        trip_record.trip_number, 
        trip_record.status,
        trip_log_record.id;
      
      -- อัปเดต delivery trip
      UPDATE delivery_trips
      SET 
        status = 'completed',
        odometer_end = trip_log_record.odometer_end,
        driver_id = CASE 
          WHEN trip_record.planned_driver_id != trip_log_record.actual_driver_id 
          THEN trip_log_record.actual_driver_id 
          ELSE driver_id 
        END,
        odometer_start = COALESCE(odometer_start, trip_log_record.odometer_start),
        updated_at = NOW()
      WHERE id = trip_record.id;
      
      -- อัปเดต delivery_trip_id ใน trip_log ถ้ายังไม่ได้ตั้งค่า
      IF trip_log_record.delivery_trip_id IS NULL OR trip_log_record.delivery_trip_id != trip_record.id THEN
        UPDATE trip_logs
        SET delivery_trip_id = trip_record.id
        WHERE id = trip_log_record.id;
      END IF;
      
      -- อัปเดต delivery_status ของ stores เป็น 'delivered'
      UPDATE delivery_trip_stores
      SET 
        delivery_status = 'delivered',
        delivered_at = COALESCE(delivered_at, trip_log_record.checkin_time)
      WHERE delivery_trip_id = trip_record.id
        AND delivery_status != 'delivered';
      
      updated_count := updated_count + 1;
      
      RAISE NOTICE '  → Updated delivery trip % to completed (driver: % -> %, odometer_end: %)', 
        trip_record.trip_number,
        trip_record.planned_driver_id,
        trip_log_record.actual_driver_id,
        trip_log_record.odometer_end;
    ELSE
      RAISE NOTICE 'No completed trip_log found for delivery trip % (vehicle: %, date: %)', 
        trip_record.trip_number,
        trip_record.vehicle_plate,
        trip_record.planned_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed fixing delivery trips. Updated % trips.', updated_count;
END $$;

-- ========================================
-- Query to check delivery trips that need fixing (before running the fix)
-- ========================================
-- SELECT 
--   dt.id,
--   dt.trip_number,
--   dt.vehicle_id,
--   v.plate as vehicle_plate,
--   dt.planned_date,
--   dt.status,
--   dt.driver_id as planned_driver_id,
--   p.full_name as planned_driver_name,
--   COUNT(tl.id) as completed_trip_logs_count,
--   MAX(tl.checkin_time) as latest_checkin_time
-- FROM delivery_trips dt
-- INNER JOIN vehicles v ON dt.vehicle_id = v.id
-- LEFT JOIN profiles p ON dt.driver_id = p.id
-- LEFT JOIN trip_logs tl ON (
--   tl.vehicle_id = dt.vehicle_id
--   AND DATE(tl.checkout_time) = dt.planned_date
--   AND tl.status = 'checked_in'
-- )
-- WHERE dt.status IN ('planned', 'in_progress')
--   AND dt.planned_date <= CURRENT_DATE
-- GROUP BY dt.id, dt.trip_number, dt.vehicle_id, v.plate, dt.planned_date, dt.status, dt.driver_id, p.full_name
-- HAVING COUNT(tl.id) > 0
-- ORDER BY dt.planned_date DESC, dt.created_at DESC;

