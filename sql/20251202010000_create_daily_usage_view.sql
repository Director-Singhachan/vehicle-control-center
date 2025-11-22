-- ========================================
-- Create Daily Usage View
-- สร้าง view สำหรับแสดงการใช้งานรายวัน
-- ========================================

CREATE OR REPLACE VIEW public.vehicle_usage_daily AS
SELECT 
  date_trunc('day', vu.start_time)::date as day,
  COUNT(DISTINCT vu.vehicle_id) as active_vehicles,
  COUNT(*) as total_trips,
  SUM(vu.distance_km) as total_distance,
  AVG(vu.distance_km) as avg_distance,
  SUM(vu.duration_hours) as total_hours
FROM public.vehicle_usage vu
WHERE vu.status = 'completed'
  AND vu.start_time >= now() - interval '90 days'  -- เก็บข้อมูล 90 วันล่าสุด
GROUP BY date_trunc('day', vu.start_time)::date
ORDER BY day DESC;

-- หมายเหตุ:
-- - View นี้ใช้สำหรับแสดงกราฟการใช้งานรายวัน
-- - Frontend สามารถ query ข้อมูล 7-30 วันล่าสุดได้
-- - active_vehicles = จำนวนรถที่ใช้งานในวันนั้น

-- ตัวอย่างการใช้งาน:
-- SELECT * FROM vehicle_usage_daily 
-- WHERE day >= CURRENT_DATE - INTERVAL '7 days'
-- ORDER BY day;

