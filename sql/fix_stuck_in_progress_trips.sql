-- ========================================
-- แก้ทริปที่ค้างสถานะ "กำลังจัดส่ง" (in_progress) แม้ว่าจะ check-in แล้ว
-- ========================================
-- สำหรับทริปที่ลงเลขไมล์ขากลับแล้ว แต่ delivery_trip ยังเป็น in_progress
-- ใช้สำหรับทริป: SD-2602-0070, SD-2602-0069 หรือทริปอื่นที่มีปัญหาเดียวกัน

-- 1. ดูรายการทริปที่ค้างอยู่ (in_progress แต่มี trip_log ที่ check-in แล้ว)
SELECT 
  dt.id,
  dt.trip_number,
  dt.status AS trip_status,
  dt.planned_date,
  dt.vehicle_id,
  v.plate AS vehicle_plate,
  tl.id AS trip_log_id,
  tl.status AS trip_log_status,
  tl.checkin_time,
  tl.odometer_end
FROM public.delivery_trips dt
JOIN public.vehicles v ON v.id = dt.vehicle_id
LEFT JOIN public.trip_logs tl ON (
  tl.vehicle_id = dt.vehicle_id
  AND DATE(tl.checkout_time) = dt.planned_date
  AND tl.status = 'checked_in'
)
WHERE dt.status = 'in_progress'
  AND tl.id IS NOT NULL  -- มี trip_log ที่ check-in แล้ว
ORDER BY dt.planned_date DESC, dt.trip_number;

-- 2. แก้ทริปที่ระบุ (แทน trip_number ด้วยเลขทริปจริง)
-- UPDATE public.delivery_trips dt
-- SET 
--   status = 'completed',
--   odometer_end = (
--     SELECT odometer_end 
--     FROM public.trip_logs tl
--     WHERE tl.vehicle_id = dt.vehicle_id
--       AND DATE(tl.checkout_time) = dt.planned_date
--       AND tl.status = 'checked_in'
--     ORDER BY tl.checkin_time DESC
--     LIMIT 1
--   ),
--   updated_at = NOW()
-- WHERE dt.trip_number IN ('SD-2602-0070', 'SD-2602-0069');

-- 3. อัปเดต delivery_trip_stores เป็น delivered สำหรับทริปที่แก้แล้ว
-- UPDATE public.delivery_trip_stores dts
-- SET 
--   delivery_status = 'delivered',
--   delivered_at = (
--     SELECT checkin_time 
--     FROM public.trip_logs tl
--     JOIN public.delivery_trips dt ON dt.vehicle_id = tl.vehicle_id
--       AND DATE(tl.checkout_time) = dt.planned_date
--     WHERE dt.id = dts.delivery_trip_id
--       AND tl.status = 'checked_in'
--     ORDER BY tl.checkin_time DESC
--     LIMIT 1
--   )
-- WHERE dts.delivery_trip_id IN (
--   SELECT id FROM public.delivery_trips 
--   WHERE trip_number IN ('SD-2602-0070', 'SD-2602-0069')
-- );

-- 4. ผูก trip_log กับ delivery_trip (ถ้ายังไม่ได้ผูก)
-- UPDATE public.trip_logs tl
-- SET delivery_trip_id = dt.id
-- FROM public.delivery_trips dt
-- WHERE tl.vehicle_id = dt.vehicle_id
--   AND DATE(tl.checkout_time) = dt.planned_date
--   AND tl.status = 'checked_in'
--   AND tl.delivery_trip_id IS NULL
--   AND dt.trip_number IN ('SD-2602-0070', 'SD-2602-0069');

-- ========================================
-- รันได้ทันที: แก้ SD-2602-0069 และ SD-2602-0070 (จากผล query ด้านบน)
-- ========================================

-- (A) อัปเดต delivery_trips เป็น completed + odometer_end
UPDATE public.delivery_trips
SET status = 'completed', odometer_end = 35049, updated_at = NOW()
WHERE id = '0be6d9d5-5bfb-4817-8f92-729fc709a9e7';

UPDATE public.delivery_trips
SET status = 'completed', odometer_end = 229709, updated_at = NOW()
WHERE id = 'cd2705a7-cbd5-4ac0-b59f-57b13ed29ab1';

-- (B) อัปเดต delivery_trip_stores เป็น delivered
UPDATE public.delivery_trip_stores
SET delivery_status = 'delivered', delivered_at = '2026-02-20 07:32:52.384+00'
WHERE delivery_trip_id = '0be6d9d5-5bfb-4817-8f92-729fc709a9e7';

UPDATE public.delivery_trip_stores
SET delivery_status = 'delivered', delivered_at = '2026-02-20 09:25:15.934+00'
WHERE delivery_trip_id = 'cd2705a7-cbd5-4ac0-b59f-57b13ed29ab1';

-- (C) ผูก trip_log กับ delivery_trip (ถ้ายังไม่ได้ผูก)
UPDATE public.trip_logs SET delivery_trip_id = '0be6d9d5-5bfb-4817-8f92-729fc709a9e7'
WHERE id = '191b6240-9b23-4990-b2a8-443f64354a68' AND (delivery_trip_id IS NULL OR delivery_trip_id != '0be6d9d5-5bfb-4817-8f92-729fc709a9e7');

UPDATE public.trip_logs SET delivery_trip_id = 'cd2705a7-cbd5-4ac0-b59f-57b13ed29ab1'
WHERE id = 'efa60245-cd25-4fcd-95a6-f2a9636ef2d1' AND (delivery_trip_id IS NULL OR delivery_trip_id != 'cd2705a7-cbd5-4ac0-b59f-57b13ed29ab1');
