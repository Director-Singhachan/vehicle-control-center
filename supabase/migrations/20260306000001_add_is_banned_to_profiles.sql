-- เพิ่มคอลัมน์ is_banned ใน profiles เพื่อ sync สถานะบัญชีจาก auth.users
-- ให้ frontend query ได้โดยตรงโดยไม่ต้องเรียก admin API

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Backfill: ตั้งค่า index เพื่อ query เร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles (is_banned);

COMMENT ON COLUMN profiles.is_banned IS 'Sync จาก auth.users ban_duration — อัปเดตโดย Edge Function toggle_status';
