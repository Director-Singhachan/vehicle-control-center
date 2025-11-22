-- เพิ่มคอลัมน์สำหรับระบุว่าการบันทึกการใช้งานรถเป็นการ "บันทึกย้อนหลัง/แก้ไขด้วยมือ" หรือไม่

alter table public.vehicle_usage
  add column if not exists is_manual_correction boolean not null default false;


