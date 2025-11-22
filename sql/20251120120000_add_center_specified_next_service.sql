-- ========================================
-- เพิ่มฟิลด์ "เลขไมล์/วันที่ถัดไปที่ศูนย์กำหนด"
-- สำหรับกรณีที่ศูนย์กำหนดเลขไมล์ถัดไปโดยตรง (ไม่ใช่คำนวณจาก interval)
-- ========================================

-- เพิ่มคอลัมน์ center_specified_next_odometer และ center_specified_next_date
alter table public.maintenance_schedules
  add column if not exists center_specified_next_odometer integer,
  add column if not exists center_specified_next_date timestamptz;

-- เพิ่ม comment อธิบาย
comment on column public.maintenance_schedules.center_specified_next_odometer is 
  'เลขไมล์ถัดไปที่ศูนย์กำหนดให้เข้าเช็คระยะ (เช่น ถ่ายน้ำมันที่ 15000 km ศูนย์กำหนดรอบถัดไปห้ามเกิน 25000 km)';

comment on column public.maintenance_schedules.center_specified_next_date is 
  'วันที่ถัดไปที่ศูนย์กำหนดให้เข้าเช็คระยะ';

-- อัปเดต constraint ให้รองรับ center_specified
-- ถ้ามี center_specified_next_odometer ต้องมากกว่า last_service_odometer
-- ลบ constraint เก่าก่อน (ถ้ามี) แล้วค่อยสร้างใหม่
alter table public.maintenance_schedules
  drop constraint if exists maintenance_schedules_valid_center_specified;

alter table public.maintenance_schedules
  add constraint maintenance_schedules_valid_center_specified check (
    (center_specified_next_odometer is null) or
    (last_service_odometer is null) or
    (center_specified_next_odometer > last_service_odometer)
  );

