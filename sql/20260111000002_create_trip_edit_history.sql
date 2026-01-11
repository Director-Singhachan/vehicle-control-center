-- Create trip_edit_history table for audit logging
-- This table stores all changes made to trip_logs and delivery_trips
CREATE TABLE IF NOT EXISTS trip_edit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_log_id UUID REFERENCES trip_logs(id) ON DELETE CASCADE,
  delivery_trip_id UUID REFERENCES delivery_trips(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  edit_reason TEXT NOT NULL,
  changes JSONB NOT NULL, -- Store old and new values
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints: must reference either trip_log OR delivery_trip, not both
  CONSTRAINT trip_edit_history_trip_check CHECK (
    (trip_log_id IS NOT NULL AND delivery_trip_id IS NULL) OR
    (trip_log_id IS NULL AND delivery_trip_id IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_trip_edit_history_trip_log ON trip_edit_history(trip_log_id);
CREATE INDEX idx_trip_edit_history_delivery_trip ON trip_edit_history(delivery_trip_id);
CREATE INDEX idx_trip_edit_history_edited_at ON trip_edit_history(edited_at DESC);
CREATE INDEX idx_trip_edit_history_edited_by ON trip_edit_history(edited_by);

-- Comments
COMMENT ON TABLE trip_edit_history IS 'ประวัติการแก้ไขข้อมูลทริป (Audit Log) - บันทึกทุกครั้งที่มีการแก้ไข trip_logs หรือ delivery_trips';
COMMENT ON COLUMN trip_edit_history.trip_log_id IS 'อ้างอิงถึง trip_logs ที่ถูกแก้ไข (null ถ้าเป็น delivery_trip)';
COMMENT ON COLUMN trip_edit_history.delivery_trip_id IS 'อ้างอิงถึง delivery_trips ที่ถูกแก้ไข (null ถ้าเป็น trip_log)';
COMMENT ON COLUMN trip_edit_history.edited_by IS 'ผู้ที่ทำการแก้ไข';
COMMENT ON COLUMN trip_edit_history.edit_reason IS 'เหตุผลในการแก้ไข (required)';
COMMENT ON COLUMN trip_edit_history.changes IS 'ข้อมูลที่เปลี่ยนแปลง ในรูปแบบ {old_values: {...}, new_values: {...}}';
COMMENT ON COLUMN trip_edit_history.edited_at IS 'วันเวลาที่ทำการแก้ไข';
