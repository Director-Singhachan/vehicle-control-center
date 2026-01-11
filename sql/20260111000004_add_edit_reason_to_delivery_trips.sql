-- Add edit_reason column to delivery_trips table
-- This stores the most recent edit reason for quick access
ALTER TABLE delivery_trips
ADD COLUMN IF NOT EXISTS edit_reason TEXT;

COMMENT ON COLUMN delivery_trips.edit_reason IS 'เหตุผลล่าสุดในการแก้ไขข้อมูลทริป (ประวัติทั้งหมดอยู่ใน trip_edit_history)';
