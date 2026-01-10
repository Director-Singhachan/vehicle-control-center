-- Manual refresh script for delivery stats
-- ใช้สำหรับรีเฟรชข้อมูลสรุปการส่งสินค้าตามรถหลังจากแก้ไข function
-- 
-- วิธีใช้:
-- 1. กำหนดช่วงวันที่ที่ต้องการ refresh
-- 2. เรียก function refresh_delivery_stats_by_day_vehicle
--
-- ตัวอย่าง: รีเฟรชข้อมูล 3 เดือนล่าสุด
SELECT refresh_delivery_stats_by_day_vehicle(
  '2024-11-01'::DATE,  -- วันที่เริ่มต้น (ปรับตามต้องการ)
  '2025-01-31'::DATE   -- วันที่สิ้นสุด (ปรับตามต้องการ)
);

-- หรือรีเฟรชข้อมูลทั้งหมดที่มี
-- SELECT refresh_delivery_stats_by_day_vehicle(
--   (SELECT MIN(planned_date) FROM delivery_trips WHERE status = 'completed')::DATE,
--   CURRENT_DATE
-- );
