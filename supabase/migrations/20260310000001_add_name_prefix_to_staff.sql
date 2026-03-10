-- เพิ่มคอลัมน์ name_prefix (คำนำหน้า) ให้กับตาราง profiles และ service_staff
-- ตัวอย่าง: 'นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', ฯลฯ

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name_prefix TEXT DEFAULT NULL;

ALTER TABLE public.service_staff
  ADD COLUMN IF NOT EXISTS name_prefix TEXT DEFAULT NULL;

COMMENT ON COLUMN public.profiles.name_prefix IS 'คำนำหน้าชื่อ เช่น นาย, นาง, นางสาว';
COMMENT ON COLUMN public.service_staff.name_prefix IS 'คำนำหน้าชื่อ เช่น นาย, นาง, นางสาว';
