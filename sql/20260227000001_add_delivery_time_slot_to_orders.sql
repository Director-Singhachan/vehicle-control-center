-- Add delivery_time_slot to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time_slot TEXT;

-- Add check constraint for valid time slots (optional but recommended)
-- Valid values: 'เช้า', 'บ่าย', NULL
ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_delivery_time_slot;
ALTER TABLE orders ADD CONSTRAINT check_delivery_time_slot 
  CHECK (delivery_time_slot IN ('เช้า', 'บ่าย') OR delivery_time_slot IS NULL);

COMMENT ON COLUMN orders.delivery_time_slot IS 'ช่วงเวลาส่งสินค้า: เช้า หรือ บ่าย';
