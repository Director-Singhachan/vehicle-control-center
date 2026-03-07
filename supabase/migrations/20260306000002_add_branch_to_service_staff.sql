-- Migration: เพิ่ม branch column ใน service_staff
-- แก้ปัญหาพนักงานขับรถ SD ไม่แสดงเมื่อ filter สาขา
-- เดิม: branch ดึงจาก profiles.branch ผ่าน user_id (เปราะบางเมื่อ user ถูกลบหรือไม่ผูกบัญชี)
-- ใหม่: branch เก็บตรงใน service_staff เพื่อคงข้อมูลอิสระจากสถานะบัญชี

-- ─── 1. เพิ่มคอลัมน์ branch ────────────────────────────────────────────────
ALTER TABLE public.service_staff
  ADD COLUMN IF NOT EXISTS branch TEXT;

COMMENT ON COLUMN public.service_staff.branch IS
  'สาขาของพนักงาน (เช่น SD, BKK) — เก็บตรงในตารางเพื่อไม่ขึ้นกับสถานะบัญชี user';

-- ─── 2. Backfill branch จาก profiles ที่ยังมีอยู่และมีข้อมูล branch ──────────
UPDATE public.service_staff ss
SET branch = p.branch
FROM public.profiles p
WHERE ss.user_id = p.id
  AND p.branch IS NOT NULL
  AND ss.branch IS NULL;

-- ─── 3. Index เพื่อเร่ง query filter by branch ───────────────────────────────
CREATE INDEX IF NOT EXISTS service_staff_branch_idx
  ON public.service_staff(branch)
  WHERE branch IS NOT NULL;
