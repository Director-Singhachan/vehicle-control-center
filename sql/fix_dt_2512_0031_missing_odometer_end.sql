-- ========================================
-- Fix DT-2512-0031 Missing Odometer End
-- แก้ไขปัญหาทริป DT-2512-0031 ที่ไม่มี odometer_end
-- แม้ว่า trip_log จะกลับมาเรียบร้อยแล้ว
-- ========================================

-- Step 1: ตรวจสอบข้อมูลปัจจุบัน
SELECT 
  'delivery_trips' as table_name,
  dt.id,
  dt.trip_number,
  dt.vehicle_id,
  v.plate as vehicle_plate,
  dt.planned_date,
  dt.status,
  dt.odometer_start,
  dt.odometer_end,
  dt.created_at,
  dt.updated_at
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
WHERE dt.trip_number = 'DT-2512-0031';

-- Step 2: ตรวจสอบ trip_logs ที่เกี่ยวข้อง
SELECT 
  'trip_logs' as table_name,
  tl.id,
  tl.vehicle_id,
  v.plate as vehicle_plate,
  tl.checkout_time,
  tl.checkin_time,
  tl.odometer_start,
  tl.odometer_end,
  tl.manual_distance_km,
  tl.status,
  tl.destination,
  tl.delivery_trip_id,
  dt.trip_number
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
WHERE tl.id = '735a04ab-ad41-489d-a641-cfce5e678064'
   OR tl.delivery_trip_id IN (
     SELECT id FROM delivery_trips WHERE trip_number = 'DT-2512-0031'
   );

-- Step 3: ค้นหา delivery_trip_id ของ DT-2512-0031
DO $$
DECLARE
  v_delivery_trip_id UUID;
  v_trip_log_id UUID := '735a04ab-ad41-489d-a641-cfce5e678064';
  v_trip_log_odometer_end INTEGER;
  v_trip_log_vehicle_id UUID;
  v_delivery_trip_vehicle_id UUID;
  v_trip_number TEXT;
BEGIN
  -- ดึง delivery_trip_id จาก trip_number
  SELECT id, vehicle_id, trip_number
  INTO v_delivery_trip_id, v_delivery_trip_vehicle_id, v_trip_number
  FROM delivery_trips
  WHERE trip_number = 'DT-2512-0031';

  IF v_delivery_trip_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ delivery_trip ที่มี trip_number = DT-2512-0031';
  END IF;

  RAISE NOTICE 'Found delivery_trip: % (vehicle_id: %)', v_trip_number, v_delivery_trip_vehicle_id;

  -- ดึงข้อมูล trip_log
  SELECT odometer_end, vehicle_id
  INTO v_trip_log_odometer_end, v_trip_log_vehicle_id
  FROM trip_logs
  WHERE id = v_trip_log_id;

  IF v_trip_log_odometer_end IS NULL THEN
    RAISE EXCEPTION 'trip_log % ไม่มี odometer_end', v_trip_log_id;
  END IF;

  RAISE NOTICE 'Found trip_log odometer_end: % (vehicle_id: %)', 
    v_trip_log_odometer_end, v_trip_log_vehicle_id;

  -- ตรวจสอบว่ารถตรงกันหรือไม่
  IF v_trip_log_vehicle_id != v_delivery_trip_vehicle_id THEN
    RAISE WARNING 'รถไม่ตรงกัน! trip_log vehicle: %, delivery_trip vehicle: %',
      v_trip_log_vehicle_id, v_delivery_trip_vehicle_id;
    RAISE EXCEPTION 'ไม่สามารถอัปเดตได้เพราะรถไม่ตรงกัน';
  END IF;

  -- อัปเดต delivery_trip ให้มี odometer_end และ status = completed
  UPDATE delivery_trips
  SET 
    odometer_end = v_trip_log_odometer_end,
    status = 'completed',
    updated_at = NOW()
  WHERE id = v_delivery_trip_id;

  RAISE NOTICE 'Updated delivery_trip % with odometer_end: %', 
    v_trip_number, v_trip_log_odometer_end;

  -- อัปเดต trip_log ให้ link กับ delivery_trip (ถ้ายังไม่ได้ link)
  UPDATE trip_logs
  SET delivery_trip_id = v_delivery_trip_id
  WHERE id = v_trip_log_id
    AND (delivery_trip_id IS NULL OR delivery_trip_id != v_delivery_trip_id);

  IF FOUND THEN
    RAISE NOTICE 'Linked trip_log % to delivery_trip %', v_trip_log_id, v_trip_number;
  ELSE
    RAISE NOTICE 'trip_log % already linked to delivery_trip %', v_trip_log_id, v_trip_number;
  END IF;

  -- อัปเดต delivery_trip_stores ให้เป็น delivered
  UPDATE delivery_trip_stores
  SET 
    delivery_status = 'delivered',
    delivered_at = NOW()
  WHERE delivery_trip_id = v_delivery_trip_id
    AND delivery_status != 'delivered';

  RAISE NOTICE 'Updated delivery_trip_stores for trip %', v_trip_number;

END $$;

-- Step 4: ตรวจสอบผลลัพธ์หลังแก้ไข
SELECT 
  'After Fix - delivery_trips' as status,
  dt.id,
  dt.trip_number,
  v.plate as vehicle_plate,
  dt.planned_date,
  dt.status,
  dt.odometer_start,
  dt.odometer_end,
  CASE 
    WHEN dt.odometer_end IS NOT NULL AND dt.odometer_start IS NOT NULL 
    THEN dt.odometer_end - dt.odometer_start 
    ELSE NULL 
  END as distance_km
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
WHERE dt.trip_number = 'DT-2512-0031';

-- Step 5: ตรวจสอบ trip_logs ที่เกี่ยวข้อง
SELECT 
  'After Fix - trip_logs' as status,
  tl.id,
  v.plate as vehicle_plate,
  tl.checkout_time,
  tl.checkin_time,
  tl.odometer_start,
  tl.odometer_end,
  tl.status,
  tl.destination,
  dt.trip_number as linked_delivery_trip
FROM trip_logs tl
LEFT JOIN vehicles v ON tl.vehicle_id = v.id
LEFT JOIN delivery_trips dt ON tl.delivery_trip_id = dt.id
WHERE tl.id = '735a04ab-ad41-489d-a641-cfce5e678064';

-- Step 6: ตรวจสอบ delivery_trip_stores
SELECT 
  'After Fix - delivery_trip_stores' as status,
  dts.id,
  s.customer_code,
  s.customer_name,
  dts.sequence_order,
  dts.delivery_status,
  dts.delivered_at
FROM delivery_trip_stores dts
LEFT JOIN stores s ON dts.store_id = s.id
WHERE dts.delivery_trip_id IN (
  SELECT id FROM delivery_trips WHERE trip_number = 'DT-2512-0031'
)
ORDER BY dts.sequence_order;
