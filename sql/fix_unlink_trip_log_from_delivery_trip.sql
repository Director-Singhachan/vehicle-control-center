-- ========================================
-- แก้ไขกรณี: เคสนอกทริปถูกผูกกับ delivery_trip ผิด (ลงขากลับแล้วระบบไปผูกกับทริปที่สร้างทีหลัง)
-- ========================================
-- ใช้เมื่อ: รถออกใช้งานทั่วไป (ไม่มีทริปส่งของ) แล้วคุณสร้าง delivery_trip ทีหลัง
--          พอลงขากลับ ระบบเดิมไปผูก trip_log กับ delivery_trip นั้นโดยอัตโนมัติ (ผิด)
--
-- วิธีใช้:
-- 1. รัน Step 1 เพื่อดูรายการที่อาจผูกผิด (ทริปสร้างหลังเวลาออกรถ)
-- 2. เลือกแก้เฉพาะรายการ: ใส่ trip_log_id หรือ delivery_trip_id ใน Step 2 แล้วรัน
-- 3. หรือรัน Step 3 เพื่อแก้ทั้งหมดที่ตรงเงื่อนไข (ใช้ด้วยความระมัดระวัง)

-- ========================================
-- Step 1: แสดงรายการที่อาจผูกผิด
-- (delivery_trip ถูกสร้างหลังเวลาที่รถออก = น่าจะเป็นเคสนอกทริปที่ผูกผิด)
-- ========================================
SELECT
  tl.id AS trip_log_id,
  tl.vehicle_id,
  v.plate,
  tl.checkout_time,
  tl.checkin_time,
  tl.delivery_trip_id,
  dt.trip_number,
  dt.status AS delivery_status,
  dt.created_at AS delivery_trip_created_at,
  CASE
    WHEN dt.created_at > tl.checkout_time THEN '⚠️ น่าผูกผิด (ทริปสร้างหลังออกรถ)'
    ELSE 'ตรวจสอบเอง'
  END AS note
FROM trip_logs tl
INNER JOIN delivery_trips dt ON dt.id = tl.delivery_trip_id
LEFT JOIN vehicles v ON v.id = tl.vehicle_id
WHERE tl.delivery_trip_id IS NOT NULL
  AND tl.status = 'checked_in'
ORDER BY tl.checkin_time DESC;

-- รายการที่ "น่าผูกผิด" เฉพาะ (ทริปสร้างหลังเวลาออก)
SELECT
  tl.id AS trip_log_id,
  v.plate,
  tl.checkout_time,
  tl.checkin_time,
  dt.trip_number,
  dt.created_at AS delivery_trip_created_at
FROM trip_logs tl
INNER JOIN delivery_trips dt ON dt.id = tl.delivery_trip_id
LEFT JOIN vehicles v ON v.id = tl.vehicle_id
WHERE tl.delivery_trip_id IS NOT NULL
  AND tl.status = 'checked_in'
  AND dt.created_at > tl.checkout_time
ORDER BY tl.checkin_time DESC;

-- ========================================
-- Step 2: แก้ไขเฉพาะรายการ (ระบุ ID เอง)
-- ========================================
-- วิธีที่ A: ระบุ trip_log_id ที่ต้องการยกเลิกการผูก
-- วิธีที่ B: ระบุ delivery_trip_id ที่ต้องการ reset กลับเป็น planned
--
-- ตัวอย่าง: แก้ trip_log ที่ id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- ให้คัดลอกบล็อกด้านล่าง แล้วแทนที่ ID จริง แล้วรัน

DO $$
DECLARE
  v_trip_log_id UUID := '00000000-0000-0000-0000-000000000000';  -- ⬅️ ใส่ trip_log_id ที่ต้องการแก้
  v_delivery_trip_id UUID;
BEGIN
  -- ดึง delivery_trip_id จาก trip_log
  SELECT delivery_trip_id INTO v_delivery_trip_id
  FROM trip_logs
  WHERE id = v_trip_log_id AND delivery_trip_id IS NOT NULL;

  IF v_delivery_trip_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ trip_log หรือ trip_log ไม่มี delivery_trip_id: %', v_trip_log_id;
  END IF;

  -- 1) ยกเลิกการผูก trip_log
  UPDATE trip_logs
  SET delivery_trip_id = NULL
  WHERE id = v_trip_log_id;
  RAISE NOTICE 'Unlinked trip_log % from delivery_trip', v_trip_log_id;

  -- 2) Reset delivery_trip กลับเป็น planned
  UPDATE delivery_trips
  SET status = 'planned',
      odometer_start = NULL,
      odometer_end = NULL,
      updated_at = NOW()
  WHERE id = v_delivery_trip_id;
  RAISE NOTICE 'Reset delivery_trip % to planned', v_delivery_trip_id;

  -- 3) Reset ร้านในทริปกลับเป็น pending
  UPDATE delivery_trip_stores
  SET delivery_status = 'pending',
      delivered_at = NULL
  WHERE delivery_trip_id = v_delivery_trip_id;
  RAISE NOTICE 'Reset delivery_trip_stores to pending for delivery_trip %', v_delivery_trip_id;

  RAISE NOTICE 'Done.';
END $$;

-- ========================================
-- Step 3 (เลือกใช้): แก้ทั้งหมดที่ "ทริปสร้างหลังเวลาออกรถ"
-- ========================================
-- ใช้เมื่อมั่นใจว่าทุกรายการที่ตรงเงื่อนไขเป็นเคสผูกผิดจริง
-- แนะนำให้รัน Step 1 ก่อน แล้วตรวจสอบรายการก่อนรัน Step 3

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT tl.id AS trip_log_id, tl.delivery_trip_id
    FROM trip_logs tl
    INNER JOIN delivery_trips dt ON dt.id = tl.delivery_trip_id
    WHERE tl.delivery_trip_id IS NOT NULL
      AND tl.status = 'checked_in'
      AND dt.created_at > tl.checkout_time
  LOOP
    -- Unlink trip_log
    UPDATE trip_logs SET delivery_trip_id = NULL WHERE id = r.trip_log_id;
    -- Reset delivery_trip
    UPDATE delivery_trips
    SET status = 'planned', odometer_start = NULL, odometer_end = NULL, updated_at = NOW()
    WHERE id = r.delivery_trip_id;
    -- Reset stores
    UPDATE delivery_trip_stores
    SET delivery_status = 'pending', delivered_at = NULL
    WHERE delivery_trip_id = r.delivery_trip_id;

    v_count := v_count + 1;
    RAISE NOTICE 'Fixed trip_log % (delivery_trip %)', r.trip_log_id, r.delivery_trip_id;
  END LOOP;

  RAISE NOTICE 'Total fixed: %', v_count;
END $$;

-- ========================================
-- Step 4: ตรวจสอบหลังแก้ (optional)
-- ========================================
-- ดู trip_logs ที่ยังผูกกับ delivery_trip อยู่
-- SELECT id, vehicle_id, checkout_time, checkin_time, delivery_trip_id
-- FROM trip_logs
-- WHERE delivery_trip_id IS NOT NULL AND status = 'checked_in'
-- ORDER BY checkin_time DESC;
