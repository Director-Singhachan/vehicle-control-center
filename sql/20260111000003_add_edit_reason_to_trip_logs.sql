-- Add edit_reason column to trip_logs table
-- This stores the most recent edit reason for quick access
ALTER TABLE trip_logs
ADD COLUMN IF NOT EXISTS edit_reason TEXT;

COMMENT ON COLUMN trip_logs.edit_reason IS 'เหตุผลล่าสุดในการแก้ไขข้อมูลทริป (ประวัติทั้งหมดอยู่ใน trip_edit_history)';
