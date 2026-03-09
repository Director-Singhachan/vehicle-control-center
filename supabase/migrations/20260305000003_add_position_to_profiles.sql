-- เพิ่มฟิลด์ตำแหน่งงาน (position) ใน profiles
-- ต่างจาก role (สิทธิ์ระบบ) และ department (แผนก)
-- เช่น "หัวหน้าทีมขนส่ง", "พนักงานขับรถประจำ", "ผู้ช่วยผู้จัดการ"

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position TEXT DEFAULT NULL;
