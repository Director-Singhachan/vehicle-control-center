-- ========================================
-- Migration: Add Trip Log Constraints
-- ป้องกันปัญหาการเชื่อมโยง trip_logs และ delivery_trips
-- ========================================
-- File: 20251211000000_add_trip_log_constraints.sql

-- ========================================
-- Step 1: ทำความสะอาดข้อมูลเก่าที่ซ้ำกัน
-- ========================================
-- ก่อนเพิ่ม UNIQUE constraint ต้องแก้ไขข้อมูลที่ซ้ำก่อน

-- ตรวจสอบ delivery_trip_id ที่ซ้ำกัน
SELECT 
  delivery_trip_id,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as trip_log_ids
FROM trip_logs
WHERE delivery_trip_id IS NOT NULL
GROUP BY delivery_trip_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- ปิด trigger validation ชั่วคราว
ALTER TABLE trip_logs DISABLE TRIGGER validate_trip_odometer_trigger;

-- แก้ไขข้อมูลซ้ำ: เก็บ trip log ที่เก่าที่สุด, ลบ link ของอันอื่น
DO $$
DECLARE
  dup_record RECORD;
  keep_trip_log_id UUID;
BEGIN
  FOR dup_record IN 
    SELECT delivery_trip_id, COUNT(*) as count
    FROM trip_logs
    WHERE delivery_trip_id IS NOT NULL
    GROUP BY delivery_trip_id
    HAVING COUNT(*) > 1
  LOOP
    -- เลือก trip log ที่เก่าที่สุดเพื่อเก็บไว้
    SELECT id INTO keep_trip_log_id
    FROM trip_logs
    WHERE delivery_trip_id = dup_record.delivery_trip_id
    ORDER BY checkout_time ASC
    LIMIT 1;
    
    RAISE NOTICE 'Delivery trip % has % trip logs, keeping %',
      dup_record.delivery_trip_id,
      dup_record.count,
      keep_trip_log_id;
    
    -- ลบ delivery_trip_id จาก trip logs อื่นๆ
    UPDATE trip_logs
    SET delivery_trip_id = NULL
    WHERE delivery_trip_id = dup_record.delivery_trip_id
      AND id != keep_trip_log_id;
  END LOOP;
  
  RAISE NOTICE 'Cleaned up duplicate delivery_trip_id references';
END $$;

-- เปิด trigger validation กลับ
ALTER TABLE trip_logs ENABLE TRIGGER validate_trip_odometer_trigger;

-- ตรวจสอบอีกครั้งว่าไม่มีซ้ำแล้ว
SELECT 
  delivery_trip_id,
  COUNT(*) as count
FROM trip_logs
WHERE delivery_trip_id IS NOT NULL
GROUP BY delivery_trip_id
HAVING COUNT(*) > 1;
-- ควรได้ 0 rows

-- ========================================
-- Step 2: เพิ่ม UNIQUE Constraint
-- ========================================
-- ป้องกันไม่ให้หลาย trip logs ใช้ delivery_trip_id เดียวกัน

ALTER TABLE trip_logs
ADD CONSTRAINT unique_delivery_trip_per_log 
UNIQUE (delivery_trip_id);

COMMENT ON CONSTRAINT unique_delivery_trip_per_log ON trip_logs IS 
'Ensures one delivery trip can only be linked to one trip log';

-- ========================================
-- Step 3: สร้าง Function ตรวจสอบ Vehicle Match
-- ========================================
-- ป้องกันการผูก trip log กับ delivery trip ที่รถไม่ตรงกัน

CREATE OR REPLACE FUNCTION check_trip_log_vehicle_match()
RETURNS TRIGGER AS $$
DECLARE
  delivery_trip_vehicle_id UUID;
  trip_log_vehicle_plate TEXT;
  delivery_trip_vehicle_plate TEXT;
BEGIN
  -- ถ้าไม่มี delivery_trip_id ก็ผ่าน
  IF NEW.delivery_trip_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- ดึง vehicle_id จาก delivery_trip
  SELECT vehicle_id INTO delivery_trip_vehicle_id
  FROM delivery_trips
  WHERE id = NEW.delivery_trip_id;
  
  -- ตรวจสอบว่า delivery trip มีอยู่จริง
  IF delivery_trip_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Delivery trip not found: %', NEW.delivery_trip_id;
  END IF;
  
  -- ตรวจสอบว่า vehicle_id ตรงกัน
  IF delivery_trip_vehicle_id != NEW.vehicle_id THEN
    -- ดึงทะเบียนรถเพื่อแสดง error message ที่ชัดเจน
    SELECT plate INTO trip_log_vehicle_plate
    FROM vehicles WHERE id = NEW.vehicle_id;
    
    SELECT plate INTO delivery_trip_vehicle_plate
    FROM vehicles WHERE id = delivery_trip_vehicle_id;
    
    RAISE EXCEPTION 'Vehicle mismatch: trip_log vehicle (%) != delivery_trip vehicle (%)', 
      trip_log_vehicle_plate, delivery_trip_vehicle_plate;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Step 4: สร้าง Trigger
-- ========================================

-- ลบ trigger เก่าถ้ามี
DROP TRIGGER IF EXISTS check_trip_log_vehicle_match_trigger ON trip_logs;

-- สร้าง trigger ใหม่
CREATE TRIGGER check_trip_log_vehicle_match_trigger
BEFORE INSERT OR UPDATE OF delivery_trip_id, vehicle_id ON trip_logs
FOR EACH ROW
EXECUTE FUNCTION check_trip_log_vehicle_match();

COMMENT ON TRIGGER check_trip_log_vehicle_match_trigger ON trip_logs IS 
'Validates that trip_log vehicle_id matches delivery_trip vehicle_id';

-- ========================================
-- Step 5: สร้างตาราง Vehicle Change Log
-- ========================================

CREATE TABLE IF NOT EXISTS public.delivery_trip_vehicle_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  old_vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  new_vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT different_vehicles CHECK (old_vehicle_id != new_vehicle_id)
);

-- Indexes
CREATE INDEX idx_delivery_trip_vehicle_changes_trip 
  ON public.delivery_trip_vehicle_changes(delivery_trip_id);

CREATE INDEX idx_delivery_trip_vehicle_changes_date 
  ON public.delivery_trip_vehicle_changes(changed_at DESC);

-- Comments
COMMENT ON TABLE public.delivery_trip_vehicle_changes IS 
'Log of vehicle changes for delivery trips';

COMMENT ON COLUMN public.delivery_trip_vehicle_changes.reason IS 
'Reason for changing vehicle (e.g., "รถเสีย", "เปลี่ยนแผน")';

-- ========================================
-- Step 6: RLS Policies
-- ========================================

ALTER TABLE public.delivery_trip_vehicle_changes ENABLE ROW LEVEL SECURITY;

-- อ่านได้ทุกคน
CREATE POLICY delivery_trip_vehicle_changes_select 
  ON public.delivery_trip_vehicle_changes
  FOR SELECT TO authenticated
  USING (true);

-- เพิ่มได้เฉพาะ admin/manager
CREATE POLICY delivery_trip_vehicle_changes_insert 
  ON public.delivery_trip_vehicle_changes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ไม่อนุญาตให้ลบหรือแก้ไข (audit log)
-- No DELETE or UPDATE policies

-- ========================================
-- Step 7: ตรวจสอบผลลัพธ์
-- ========================================

-- ตรวจสอบ constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'trip_logs'::regclass
  AND conname LIKE '%delivery_trip%';

-- ตรวจสอบ triggers
SELECT 
  tgname as trigger_name,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'trip_logs'::regclass
  AND tgname LIKE '%vehicle%';

-- ตรวจสอบตาราง vehicle changes
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'delivery_trip_vehicle_changes'
ORDER BY ordinal_position;

-- ========================================
-- การใช้งาน
-- ========================================

-- ทดสอบ UNIQUE constraint (ควร error)
-- INSERT INTO trip_logs (vehicle_id, driver_id, delivery_trip_id, ...)
-- VALUES (..., 'existing-delivery-trip-id', ...);

-- ทดสอบ vehicle match (ควร error)
-- INSERT INTO trip_logs (vehicle_id, driver_id, delivery_trip_id, ...)
-- VALUES ('vehicle-A-id', ..., 'delivery-trip-for-vehicle-B-id', ...);

-- บันทึกการเปลี่ยนรถ
-- INSERT INTO delivery_trip_vehicle_changes 
-- (delivery_trip_id, old_vehicle_id, new_vehicle_id, reason, changed_by)
-- VALUES (...);
