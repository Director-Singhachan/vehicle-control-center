-- ========================================
-- เพิ่มฟิลด์ "ไม่เกิน" (Max Interval) สำหรับกำหนดการจากศูนย์
-- ========================================

-- เพิ่มคอลัมน์ max_interval_km และ max_interval_months
alter table public.maintenance_schedules
  add column if not exists max_interval_km integer,
  add column if not exists max_interval_months integer;

-- เพิ่ม comment อธิบาย
comment on column public.maintenance_schedules.max_interval_km is 
  'ระยะทางสูงสุดที่ต้องทำ PM (ตามกำหนดการจากศูนย์) เช่น ถ้าตั้งทุก 10,000 km แต่ศูนย์กำหนดไม่เกิน 15,000 km';

comment on column public.maintenance_schedules.max_interval_months is 
  'ระยะเวลาสูงสุดที่ต้องทำ PM (ตามกำหนดการจากศูนย์) เช่น ถ้าตั้งทุก 6 เดือน แต่ศูนย์กำหนดไม่เกิน 12 เดือน';

-- อัปเดต constraint ให้รองรับ max_interval
-- (ไม่บังคับ แต่ถ้ามีต้องมากกว่า interval ปกติ)
alter table public.maintenance_schedules
  drop constraint if exists maintenance_schedules_valid_interval;

alter table public.maintenance_schedules
  add constraint maintenance_schedules_valid_interval check (
    (interval_type = 'mileage' and interval_km > 0 and (max_interval_km is null or max_interval_km >= interval_km)) or
    (interval_type = 'time' and interval_months > 0 and (max_interval_months is null or max_interval_months >= interval_months)) or
    (interval_type = 'both' and interval_km > 0 and interval_months > 0 
     and (max_interval_km is null or max_interval_km >= interval_km)
     and (max_interval_months is null or max_interval_months >= interval_months))
  );

