-- ========================================
-- Dynamic Crew Management & Commission Calculation System
-- Migration: 20260110000000
-- ========================================
-- This migration extends the delivery trip system to support:
-- 1. Service staff management with status tracking
-- 2. Dynamic commission rate configuration
-- 3. Enhanced crew assignment with full history tracking and swap logic
-- 4. Compatibility with existing delivery_trips system

-- ========================================
-- 1. SERVICE STAFF TABLE
-- ========================================
-- Stores information about service staff (drivers, helpers)
-- Replaces the simple driver_id reference in delivery_trips with a more flexible system

CREATE TABLE IF NOT EXISTS public.service_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sick', 'leave', 'inactive')),
  default_team TEXT, -- ทีมเริ่มต้น เช่น "Team A", "Team B" (optional grouping)
  phone TEXT,
  employee_code TEXT UNIQUE, -- รหัสพนักงาน
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Indexes for service_staff
CREATE INDEX IF NOT EXISTS idx_service_staff_status ON public.service_staff(status);
CREATE INDEX IF NOT EXISTS idx_service_staff_employee_code ON public.service_staff(employee_code);
CREATE INDEX IF NOT EXISTS idx_service_staff_default_team ON public.service_staff(default_team);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_service_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_staff_updated_at
  BEFORE UPDATE ON public.service_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_service_staff_updated_at();

-- ========================================
-- 2. COMMISSION RATES TABLE
-- ========================================
-- Stores dynamic commission rate rules
-- Allows adjusting rates without code changes
-- Rates can be based on vehicle type, service type, or combination

CREATE TABLE IF NOT EXISTS public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_name TEXT NOT NULL, -- ชื่อเรท เช่น "4-Wheel Lift-Off Standard"
  vehicle_type TEXT, -- ประเภทรถ: '4-wheel', '6-wheel', '10-wheel', etc. (nullable for default rates)
  service_type TEXT, -- ประเภทบริการ: 'lift_off', 'carry_in', 'standard', etc. (nullable for default rates)
  rate_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- อัตราต่อหน่วย (บาท/ชิ้น)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE, -- วันที่เริ่มใช้เรทนี้
  effective_until DATE, -- วันที่สิ้นสุด (nullable = ไม่มีกำหนด)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  
  -- Ensure at least one classification exists (vehicle_type or service_type)
  CONSTRAINT check_rate_classification CHECK (
    vehicle_type IS NOT NULL OR service_type IS NOT NULL
  )
);

-- Indexes for commission_rates
CREATE INDEX IF NOT EXISTS idx_commission_rates_vehicle_type ON public.commission_rates(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_commission_rates_service_type ON public.commission_rates(service_type);
CREATE INDEX IF NOT EXISTS idx_commission_rates_is_active ON public.commission_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_commission_rates_effective_dates ON public.commission_rates(effective_from, effective_until);

-- Trigger for updated_at
CREATE TRIGGER trigger_update_commission_rates_updated_at
  BEFORE UPDATE ON public.commission_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_service_staff_updated_at();

-- ========================================
-- 3. DELIVERY TRIP CREWS TABLE (ENHANCED)
-- ========================================
-- Links delivery_trips with service_staff (Many-to-Many with history)
-- Supports full history tracking for staff changes during trips
-- 
-- SWAP LOGIC EXPLANATION:
-- When a staff member needs to be replaced (sick, emergency, etc.):
-- 1. Find the current active record for that staff member on the trip
-- 2. UPDATE that record:
--    - Set status = 'replaced'
--    - Set end_at = NOW()
--    - Set replaced_by_staff_id = new staff's ID
--    - Set reason_for_change = explanation
-- 3. INSERT a new record for the replacement staff:
--    - Set status = 'active'
--    - Set start_at = NOW()
--    - Set end_at = NULL
--    - Link to same delivery_trip_id
--
-- This maintains a complete audit trail of all staff changes

CREATE TABLE IF NOT EXISTS public.delivery_trip_crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE RESTRICT,
  
  -- Role in this trip
  role TEXT NOT NULL CHECK (role IN ('driver', 'helper')),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'replaced')),
  
  -- Time tracking for history
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- เวลาที่เริ่มงาน
  end_at TIMESTAMPTZ, -- เวลาที่สิ้นสุด (NULL = ยังทำงานอยู่)
  
  -- Replacement tracking
  replaced_by_staff_id UUID REFERENCES public.service_staff(id) ON DELETE SET NULL,
  reason_for_change TEXT, -- เหตุผลในการเปลี่ยน เช่น "ป่วย", "ฉุกเฉิน", "ขอกลับก่อน"
  
  -- Additional fields
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  
  -- Constraints
  -- If end_at is set, status cannot be 'active'
  CONSTRAINT check_end_at_status CHECK (
    (end_at IS NULL AND status = 'active') OR
    (end_at IS NOT NULL AND status IN ('removed', 'replaced'))
  ),
  
  -- If replaced, must have replacement staff and reason
  CONSTRAINT check_replacement_data CHECK (
    (status = 'replaced' AND replaced_by_staff_id IS NOT NULL AND reason_for_change IS NOT NULL) OR
    (status != 'replaced')
  )
);

-- Indexes for delivery_trip_crews
CREATE INDEX IF NOT EXISTS idx_delivery_trip_crews_trip_id ON public.delivery_trip_crews(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_crews_staff_id ON public.delivery_trip_crews(staff_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_crews_status ON public.delivery_trip_crews(status);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_crews_role ON public.delivery_trip_crews(role);
CREATE INDEX IF NOT EXISTS idx_delivery_trip_crews_active ON public.delivery_trip_crews(delivery_trip_id, status) 
  WHERE status = 'active';

-- Partial unique index to prevent duplicate active staff in same trip with same role
-- This replaces the UNIQUE constraint that couldn't use CASE expressions
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_trip_crews_unique_active_staff 
  ON public.delivery_trip_crews(delivery_trip_id, staff_id, role)
  WHERE status = 'active';

-- Trigger for updated_at
CREATE TRIGGER trigger_update_delivery_trip_crews_updated_at
  BEFORE UPDATE ON public.delivery_trip_crews
  FOR EACH ROW
  EXECUTE FUNCTION update_service_staff_updated_at();

-- ========================================
-- 4. COMMISSION LOGS TABLE (OPTIONAL - FOR FUTURE)
-- ========================================
-- Stores calculated commission records
-- This is an immutable audit log of all commission calculations
-- Recommended to be populated via Edge Functions, not triggers

CREATE TABLE IF NOT EXISTS public.commission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id UUID NOT NULL REFERENCES public.delivery_trips(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE RESTRICT,
  
  -- Calculation details
  total_items_delivered INTEGER NOT NULL DEFAULT 0, -- จำนวนสินค้าที่ส่งสำเร็จ
  rate_applied DECIMAL(10, 2) NOT NULL, -- อัตราที่ใช้คำนวณ
  commission_amount DECIMAL(10, 2) NOT NULL, -- ยอดคอมมิชชั่นที่ได้
  
  -- Pro-rating for partial work
  work_percentage DECIMAL(5, 2) DEFAULT 100.00, -- เปอร์เซ็นต์การทำงาน (100 = ทำงานเต็ม)
  actual_commission DECIMAL(10, 2) NOT NULL, -- คอมมิชชั่นจริงหลัง pro-rate
  
  -- Metadata
  calculation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculated_by UUID REFERENCES public.profiles(id), -- ผู้อนุมัติ/คำนวณ
  notes TEXT,
  
  -- Immutable record
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate calculations
  CONSTRAINT unique_commission_per_trip_staff UNIQUE (delivery_trip_id, staff_id)
);

-- Indexes for commission_logs
CREATE INDEX IF NOT EXISTS idx_commission_logs_trip_id ON public.commission_logs(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_commission_logs_staff_id ON public.commission_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_commission_logs_calculation_date ON public.commission_logs(calculation_date);

-- ========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on all new tables
ALTER TABLE public.service_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trip_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- SERVICE STAFF RLS
-- ----------------------------------------

-- All authenticated users can read service staff
CREATE POLICY service_staff_select ON public.service_staff
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/managers can insert
CREATE POLICY service_staff_insert ON public.service_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins/managers can update
CREATE POLICY service_staff_update ON public.service_staff
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins can delete
CREATE POLICY service_staff_delete ON public.service_staff
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ----------------------------------------
-- COMMISSION RATES RLS
-- ----------------------------------------

-- All authenticated users can read commission rates
CREATE POLICY commission_rates_select ON public.commission_rates
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/managers can insert
CREATE POLICY commission_rates_insert ON public.commission_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins/managers can update
CREATE POLICY commission_rates_update ON public.commission_rates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins can delete
CREATE POLICY commission_rates_delete ON public.commission_rates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ----------------------------------------
-- DELIVERY TRIP CREWS RLS
-- ----------------------------------------

-- All authenticated users can read crew assignments
CREATE POLICY delivery_trip_crews_select ON public.delivery_trip_crews
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins/managers/inspectors can insert crew assignments
CREATE POLICY delivery_trip_crews_insert ON public.delivery_trip_crews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

-- Admins/managers/inspectors can update crew assignments
CREATE POLICY delivery_trip_crews_update ON public.delivery_trip_crews
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

-- Only admins/managers can delete
CREATE POLICY delivery_trip_crews_delete ON public.delivery_trip_crews
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ----------------------------------------
-- COMMISSION LOGS RLS
-- ----------------------------------------

-- All authenticated users can read commission logs
CREATE POLICY commission_logs_select ON public.commission_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/managers can insert commission logs
CREATE POLICY commission_logs_insert ON public.commission_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Commission logs are immutable - no updates allowed
-- Only admins can delete (for corrections only)
CREATE POLICY commission_logs_delete ON public.commission_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ========================================
-- 6. HELPER VIEWS (OPTIONAL)
-- ========================================

-- View to get current active crew for each trip
CREATE OR REPLACE VIEW public.delivery_trip_active_crews AS
SELECT 
  dtc.delivery_trip_id,
  dtc.staff_id,
  ss.name AS staff_name,
  ss.employee_code,
  dtc.role,
  dtc.start_at,
  dtc.created_at
FROM public.delivery_trip_crews dtc
JOIN public.service_staff ss ON dtc.staff_id = ss.id
WHERE dtc.status = 'active'
  AND dtc.end_at IS NULL;

-- View to get crew change history
CREATE OR REPLACE VIEW public.delivery_trip_crew_history AS
SELECT 
  dtc.delivery_trip_id,
  dt.trip_number,
  dtc.staff_id,
  ss.name AS staff_name,
  dtc.role,
  dtc.status,
  dtc.start_at,
  dtc.end_at,
  dtc.reason_for_change,
  replacement.name AS replaced_by_name,
  dtc.created_at
FROM public.delivery_trip_crews dtc
JOIN public.delivery_trips dt ON dtc.delivery_trip_id = dt.id
JOIN public.service_staff ss ON dtc.staff_id = ss.id
LEFT JOIN public.service_staff replacement ON dtc.replaced_by_staff_id = replacement.id
ORDER BY dtc.delivery_trip_id, dtc.start_at;

-- ========================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE public.service_staff IS 'ข้อมูลพนักงานบริการ (คนขับ, ผู้ช่วย) พร้อมสถานะการทำงาน';
COMMENT ON TABLE public.commission_rates IS 'อัตราค่าคอมมิชชั่นแบบไดนามิก สามารถปรับได้ตามประเภทรถและบริการ';
COMMENT ON TABLE public.delivery_trip_crews IS 'การมอบหมายพนักงานให้กับทริป พร้อมระบบติดตามประวัติการเปลี่ยนแปลง';
COMMENT ON TABLE public.commission_logs IS 'บันทึกการคำนวณค่าคอมมิชชั่น (Immutable Audit Log)';

COMMENT ON COLUMN public.delivery_trip_crews.status IS 'สถานะ: active=กำลังทำงาน, removed=ถูกถอดออก, replaced=ถูกแทนที่';
COMMENT ON COLUMN public.delivery_trip_crews.start_at IS 'เวลาที่เริ่มทำงานในทริปนี้';
COMMENT ON COLUMN public.delivery_trip_crews.end_at IS 'เวลาที่สิ้นสุดการทำงาน (NULL = ยังทำงานอยู่)';
COMMENT ON COLUMN public.delivery_trip_crews.replaced_by_staff_id IS 'ID ของพนักงานที่มาแทน (ใช้เมื่อ status = replaced)';
COMMENT ON COLUMN public.delivery_trip_crews.reason_for_change IS 'เหตุผลในการเปลี่ยนพนักงาน เช่น ป่วย, ฉุกเฉิน';

COMMENT ON COLUMN public.commission_logs.work_percentage IS 'เปอร์เซ็นต์การทำงาน (100 = ทำงานเต็มทริป, น้อยกว่า 100 = ทำงานบางส่วน)';
COMMENT ON COLUMN public.commission_logs.actual_commission IS 'ค่าคอมมิชชั่นจริงหลังคำนวณ pro-rate ตาม work_percentage';

-- ========================================
-- 8. EXAMPLE USAGE QUERIES
-- ========================================

-- Example 1: Get all active crew members for a specific trip
-- SELECT * FROM public.delivery_trip_active_crews WHERE delivery_trip_id = 'xxx';

-- Example 2: Get complete crew change history for a trip
-- SELECT * FROM public.delivery_trip_crew_history WHERE delivery_trip_id = 'xxx';

-- Example 3: Swap a crew member (Helper got sick, replace with another)
/*
-- Step 1: End the current assignment
UPDATE public.delivery_trip_crews
SET 
  status = 'replaced',
  end_at = NOW(),
  replaced_by_staff_id = 'new-staff-uuid',
  reason_for_change = 'ป่วยกลางทาง',
  updated_by = auth.uid()
WHERE delivery_trip_id = 'trip-uuid'
  AND staff_id = 'old-staff-uuid'
  AND status = 'active';

-- Step 2: Add the replacement
INSERT INTO public.delivery_trip_crews (
  delivery_trip_id,
  staff_id,
  role,
  status,
  start_at,
  created_by
) VALUES (
  'trip-uuid',
  'new-staff-uuid',
  'helper',
  'active',
  NOW(),
  auth.uid()
);
*/

-- Example 4: Calculate commission for a completed trip
/*
-- This should be done via Edge Function, not SQL trigger
-- The function would:
-- 1. Get total delivered items from delivery_trip_items
-- 2. Get applicable commission rate from commission_rates
-- 3. Get all active crew members who completed the trip
-- 4. Calculate pro-rated commission based on work_percentage
-- 5. Insert records into commission_logs
*/
