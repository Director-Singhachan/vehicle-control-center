-- ========================================
-- Fix Daily Usage View - ใช้ trip_logs แทน vehicle_usage
-- แก้ไข view ให้ใช้ข้อมูลจาก trip_logs ที่มีข้อมูลจริง
-- ========================================

CREATE OR REPLACE VIEW public.vehicle_usage_daily AS
SELECT 
  date_trunc('day', tl.checkout_time)::date as day,
  COUNT(DISTINCT tl.vehicle_id) as active_vehicles,
  COUNT(*) as total_trips,
  SUM(COALESCE(tl.distance_km, 0)) as total_distance,
  AVG(COALESCE(tl.distance_km, 0)) as avg_distance,
  SUM(COALESCE(tl.duration_hours, 0)) as total_hours
FROM public.trip_logs tl
WHERE tl.status = 'checked_in'  -- เฉพาะการเดินทางที่เช็คอินแล้ว
  AND tl.checkout_time >= now() - interval '90 days'  -- เก็บข้อมูล 90 วันล่าสุด
GROUP BY date_trunc('day', tl.checkout_time)::date
ORDER BY day DESC;

-- หมายเหตุ:
-- - View นี้ใช้ข้อมูลจาก trip_logs แทน vehicle_usage
-- - active_vehicles = จำนวนรถที่ใช้งานในวันนั้น (นับจาก trip_logs ที่เช็คอินแล้ว)
-- - ใช้ checkout_time เป็นวันอ้างอิง
-- - Frontend สามารถ query ข้อมูล 7-30 วันล่าสุดได้

-- ตัวอย่างการใช้งาน:
-- SELECT * FROM vehicle_usage_daily 
-- WHERE day >= CURRENT_DATE - INTERVAL '7 days'
-- ORDER BY day;

