-- ========================================
-- แก้ไข constraint ของ maintenance_schedules
-- ลบ max_interval ออกจาก constraint เพราะเราไม่ใช้แล้ว
-- ========================================

-- ลบ constraint เก่าออก
alter table public.maintenance_schedules
  drop constraint if exists maintenance_schedules_valid_interval;

-- สร้าง constraint ใหม่ (ไม่รวม max_interval)
alter table public.maintenance_schedules
  add constraint maintenance_schedules_valid_interval check (
    (interval_type = 'mileage' and interval_km > 0) or
    (interval_type = 'time' and interval_months > 0) or
    (interval_type = 'both' and interval_km > 0 and interval_months > 0)
  );

