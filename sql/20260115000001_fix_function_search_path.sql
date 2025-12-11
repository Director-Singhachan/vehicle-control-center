-- ========================================
-- Fix Function Search Path Mutable
-- แก้ไข Function Search Path Mutable warnings
-- ========================================
-- 
-- Issue: Functions without SET search_path are vulnerable to search_path injection
-- Solution: Add SET search_path = '' or SET search_path = public, pg_catalog to all functions
-- ========================================

-- ========================================
-- 1. UPDATE FUNCTIONS WITH SET search_path
-- ========================================

-- 1.1 update_delivery_trip_updated_at
CREATE OR REPLACE FUNCTION update_delivery_trip_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1.2 refresh_delivery_stats_by_day_vehicle
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_vehicle(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_start DATE := p_start_date;
  v_end   DATE := p_end_date;
BEGIN
  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'start_date และ end_date ต้องไม่เป็น NULL';
  END IF;

  IF v_start > v_end THEN
    RAISE EXCEPTION 'start_date ต้องไม่มากกว่า end_date';
  END IF;

  -- ลบข้อมูลเก่าของช่วงวันที่ที่ต้องการคำนวณใหม่
  DELETE FROM public.delivery_stats_by_day_vehicle
  WHERE stat_date BETWEEN v_start AND v_end;

  -- คำนวณข้อมูลใหม่จากตาราง delivery_trips + delivery_trip_stores + delivery_trip_items
  INSERT INTO public.delivery_stats_by_day_vehicle (
    stat_date,
    vehicle_id,
    total_trips,
    total_stores,
    total_items,
    total_quantity,
    total_distance_km,
    created_at,
    updated_at
  )
  SELECT
    (COALESCE(dts.delivered_at, dt.planned_date))::date AS stat_date,
    dt.vehicle_id,
    COUNT(DISTINCT dt.id) AS total_trips,
    COUNT(DISTINCT dts.store_id) AS total_stores,
    COUNT(dti.id) AS total_items,
    COALESCE(SUM(dti.quantity), 0) AS total_quantity,
    COALESCE(SUM(
      CASE 
        WHEN dt.odometer_end IS NOT NULL AND dt.odometer_start IS NOT NULL AND dt.odometer_end > dt.odometer_start
        THEN dt.odometer_end - dt.odometer_start
        ELSE 0
      END
    ), 0) AS total_distance_km,
    now() AS created_at,
    now() AS updated_at
  FROM public.delivery_trips dt
  JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = dt.id
  LEFT JOIN public.delivery_trip_items dti ON dti.delivery_trip_store_id = dts.id
  WHERE
    dt.status = 'completed'
    AND (COALESCE(dts.delivered_at, dt.planned_date))::date BETWEEN v_start AND v_end
  GROUP BY
    (COALESCE(dts.delivered_at, dt.planned_date))::date,
    dt.vehicle_id;
END;
$$;

-- 1.3 refresh_delivery_stats_by_day_store
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_store(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_start DATE := p_start_date;
  v_end   DATE := p_end_date;
BEGIN
  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'start_date และ end_date ต้องไม่เป็น NULL';
  END IF;

  IF v_start > v_end THEN
    RAISE EXCEPTION 'start_date ต้องไม่มากกว่า end_date';
  END IF;

  -- ลบข้อมูลเก่าของช่วงวันที่ที่ต้องการคำนวณใหม่
  DELETE FROM public.delivery_stats_by_day_store
  WHERE stat_date BETWEEN v_start AND v_end;

  -- คำนวณข้อมูลใหม่จากตาราง delivery_trips + delivery_trip_stores + delivery_trip_items
  INSERT INTO public.delivery_stats_by_day_store (
    stat_date,
    store_id,
    total_trips,
    total_items,
    total_quantity,
    created_at,
    updated_at
  )
  SELECT
    (COALESCE(dts.delivered_at, dt.planned_date))::date AS stat_date,
    dts.store_id,
    COUNT(DISTINCT dt.id) AS total_trips,
    COUNT(dti.id) AS total_items,
    COALESCE(SUM(dti.quantity), 0) AS total_quantity,
    now() AS created_at,
    now() AS updated_at
  FROM public.delivery_trips dt
  JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = dt.id
  LEFT JOIN public.delivery_trip_items dti ON dti.delivery_trip_store_id = dts.id
  WHERE
    dt.status = 'completed'
    AND (COALESCE(dts.delivered_at, dt.planned_date))::date BETWEEN v_start AND v_end
  GROUP BY
    (COALESCE(dts.delivered_at, dt.planned_date))::date,
    dts.store_id;
END;
$$;

-- 1.4 refresh_delivery_stats_by_day_product
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_product(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_start DATE := p_start_date;
  v_end   DATE := p_end_date;
BEGIN
  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'start_date และ end_date ต้องไม่เป็น NULL';
  END IF;

  IF v_start > v_end THEN
    RAISE EXCEPTION 'start_date ต้องไม่มากกว่า end_date';
  END IF;

  -- ลบข้อมูลเก่าของช่วงวันที่ที่ต้องการคำนวณใหม่
  DELETE FROM public.delivery_stats_by_day_product
  WHERE stat_date BETWEEN v_start AND v_end;

  -- คำนวณข้อมูลใหม่จากตาราง delivery_trips + delivery_trip_stores + delivery_trip_items
  INSERT INTO public.delivery_stats_by_day_product (
    stat_date,
    product_id,
    total_trips,
    total_stores,
    total_quantity,
    created_at,
    updated_at
  )
  SELECT
    (COALESCE(dts.delivered_at, dt.planned_date))::date AS stat_date,
    dti.product_id,
    COUNT(DISTINCT dt.id) AS total_trips,
    COUNT(DISTINCT dts.store_id) AS total_stores,
    COALESCE(SUM(dti.quantity), 0) AS total_quantity,
    now() AS created_at,
    now() AS updated_at
  FROM public.delivery_trips dt
  JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = dt.id
  JOIN public.delivery_trip_items dti ON dti.delivery_trip_store_id = dts.id
  WHERE
    dt.status = 'completed'
    AND (COALESCE(dts.delivered_at, dt.planned_date))::date BETWEEN v_start AND v_end
  GROUP BY
    (COALESCE(dts.delivered_at, dt.planned_date))::date,
    dti.product_id;
END;
$$;

-- 1.5 generate_delivery_trip_number
CREATE OR REPLACE FUNCTION generate_delivery_trip_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  year_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
BEGIN
  -- Generate format: DT-YYYY-XXX (e.g., DT-2025-001)
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  
  -- Get last trip number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.delivery_trips
  WHERE trip_number LIKE 'DT-' || year_prefix || '-%';
  
  -- Generate new number
  new_number := 'DT-' || year_prefix || '-' || LPAD((last_number + 1)::TEXT, 3, '0');
  
  NEW.trip_number := new_number;
  RETURN NEW;
END;
$$;

-- 1.6 check_trip_log_vehicle_match
CREATE OR REPLACE FUNCTION check_trip_log_vehicle_match()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
  FROM public.delivery_trips
  WHERE id = NEW.delivery_trip_id;
  
  -- ตรวจสอบว่า delivery trip มีอยู่จริง
  IF delivery_trip_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Delivery trip not found: %', NEW.delivery_trip_id;
  END IF;
  
  -- ตรวจสอบว่า vehicle_id ตรงกัน
  IF delivery_trip_vehicle_id != NEW.vehicle_id THEN
    -- ดึงทะเบียนรถเพื่อแสดง error message ที่ชัดเจน
    SELECT plate INTO trip_log_vehicle_plate
    FROM public.vehicles WHERE id = NEW.vehicle_id;
    
    SELECT plate INTO delivery_trip_vehicle_plate
    FROM public.vehicles WHERE id = delivery_trip_vehicle_id;
    
    RAISE EXCEPTION 'Vehicle mismatch: Trip log vehicle (%) does not match delivery trip vehicle (%)', 
      COALESCE(trip_log_vehicle_plate, 'Unknown'), 
      COALESCE(delivery_trip_vehicle_plate, 'Unknown');
  END IF;
  
  RETURN NEW;
END;
$$;

-- 1.7 refresh_delivery_stats_by_day_store_product
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_store_product(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_start DATE := p_start_date;
  v_end   DATE := p_end_date;
BEGIN
  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'start_date และ end_date ต้องไม่เป็น NULL';
  END IF;

  IF v_start > v_end THEN
    RAISE EXCEPTION 'start_date ต้องไม่มากกว่า end_date';
  END IF;

  -- ลบข้อมูลเก่าของช่วงวันที่ที่ต้องการคำนวณใหม่
  DELETE FROM public.delivery_stats_by_day_store_product
  WHERE stat_date BETWEEN v_start AND v_end;

  -- คำนวณใหม่จาก delivery_trips + delivery_trip_stores + delivery_trip_items
  INSERT INTO public.delivery_stats_by_day_store_product (
    stat_date,
    store_id,
    product_id,
    total_deliveries,
    total_quantity,
    created_at,
    updated_at
  )
  SELECT
    (COALESCE(dts.delivered_at, dt.planned_date))::date AS stat_date,
    dts.store_id,
    dti.product_id,
    COUNT(*) AS total_deliveries,
    COALESCE(SUM(dti.quantity), 0) AS total_quantity,
    now() AS created_at,
    now() AS updated_at
  FROM public.delivery_trips dt
  JOIN public.delivery_trip_stores dts ON dts.delivery_trip_id = dt.id
  JOIN public.delivery_trip_items dti ON dti.delivery_trip_store_id = dts.id
  WHERE
    dt.status = 'completed'
    AND (COALESCE(dts.delivered_at, dt.planned_date))::date BETWEEN v_start AND v_end
  GROUP BY
    (COALESCE(dts.delivered_at, dt.planned_date))::date,
    dts.store_id,
    dti.product_id;
END;
$$;

-- 1.8 update_commission_rates_updated_at (uses same function as update_service_staff_updated_at)
-- Note: This function is shared, so we update it once and it applies to all triggers

-- 1.9 update_delivery_trip_crews_updated_at (uses same function as update_service_staff_updated_at)
-- Note: This function is shared, so we update it once and it applies to all triggers

-- 1.10 update_service_staff_updated_at
CREATE OR REPLACE FUNCTION update_service_staff_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1.11 update_trip_logs_updated_at
CREATE OR REPLACE FUNCTION public.update_trip_logs_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1.12 check_vehicle_available
CREATE OR REPLACE FUNCTION public.check_vehicle_available()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_available BOOLEAN;
BEGIN
  -- ตรวจสอบว่ามีการ checkout อยู่แล้วหรือไม่
  SELECT NOT EXISTS(
    SELECT 1 
    FROM public.trip_logs 
    WHERE vehicle_id = NEW.vehicle_id 
      AND status = 'checked_out'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) INTO v_is_available;
  
  IF NOT v_is_available THEN
    RAISE EXCEPTION 'Vehicle % is already checked out', NEW.vehicle_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 1.13 validate_trip_odometer
CREATE OR REPLACE FUNCTION public.validate_trip_odometer()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  last_odometer INTEGER;
BEGIN
  -- When checking in, validate odometer_end
  IF NEW.status = 'checked_in' AND NEW.odometer_end IS NOT NULL THEN
    -- Get the last odometer reading (from fuel_records or previous trip)
    SELECT COALESCE(
      (SELECT odometer FROM public.fuel_records 
       WHERE vehicle_id = NEW.vehicle_id 
       ORDER BY filled_at DESC LIMIT 1),
      (SELECT odometer_end FROM public.trip_logs 
       WHERE vehicle_id = NEW.vehicle_id 
       AND odometer_end IS NOT NULL
       ORDER BY checkin_time DESC LIMIT 1),
      0
    ) INTO last_odometer;
    
    -- Check if odometer_end is reasonable (not less than last known reading)
    IF NEW.odometer_end < last_odometer THEN
      RAISE EXCEPTION 'Odometer reading (%) is less than last known reading (%). Please verify.', 
        NEW.odometer_end, last_odometer;
    END IF;
    
    -- NOTE: Distance validation (> 500 km) is now handled at UI level with user confirmation
    -- We don't block saving here to allow legitimate long-distance trips
  END IF;
  
  RETURN NEW;
END;
$$;

-- 1.14 run_daily_summary_refresh
-- Note: If this function exists in your database, you need to add SET search_path = '' to it
-- Example:
-- CREATE OR REPLACE FUNCTION public.run_daily_summary_refresh(...)
-- RETURNS ...
-- LANGUAGE plpgsql
-- SET search_path = ''
-- AS $$ ... $$;

-- 1.15 get_vehicle_status
CREATE OR REPLACE FUNCTION public.get_vehicle_status(p_vehicle_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_in_use boolean;
  v_in_maintenance boolean;
BEGIN
  -- ตรวจสอบว่ากำลังใช้งานอยู่หรือไม่จาก trip_logs
  SELECT EXISTS(
    SELECT 1 
    FROM public.trip_logs 
    WHERE vehicle_id = p_vehicle_id 
      AND status = 'checked_out'
  ) INTO v_in_use;
  
  -- ตรวจสอบว่าอยู่ในการซ่อมบำรุงหรือไม่
  SELECT EXISTS(
    SELECT 1 
    FROM public.tickets 
    WHERE vehicle_id = p_vehicle_id 
      AND status IN ('pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress')
  ) INTO v_in_maintenance;
  
  -- กำหนดสถานะ
  IF v_in_use THEN
    v_status := 'active';
  ELSIF v_in_maintenance THEN
    v_status := 'maintenance';
  ELSE
    v_status := 'idle';
  END IF;
  
  RETURN v_status;
END;
$$;

-- ========================================
-- 2. COMMENTS
-- ========================================

COMMENT ON FUNCTION update_delivery_trip_updated_at() IS 
  'Trigger function to update updated_at timestamp (fixed search_path)';

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_vehicle(DATE, DATE) IS 
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันตามรถ (fixed search_path)';

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_store(DATE, DATE) IS 
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันตามร้านค้า (fixed search_path)';

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_product(DATE, DATE) IS 
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันตามสินค้า (fixed search_path)';

COMMENT ON FUNCTION generate_delivery_trip_number() IS 
  'Generate delivery trip number in format DT-YYYY-XXX (fixed search_path)';

COMMENT ON FUNCTION check_trip_log_vehicle_match() IS 
  'Validate that trip_log vehicle matches delivery_trip vehicle (fixed search_path)';

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_store_product(DATE, DATE) IS 
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันระดับร้าน+สินค้า (fixed search_path)';

COMMENT ON FUNCTION update_service_staff_updated_at() IS 
  'Trigger function to update updated_at timestamp for service_staff, commission_rates, and delivery_trip_crews (fixed search_path)';

COMMENT ON FUNCTION public.update_trip_logs_updated_at() IS 
  'Trigger function to update updated_at timestamp for trip_logs (fixed search_path)';

COMMENT ON FUNCTION public.check_vehicle_available() IS 
  'ป้องกันการ checkout ซ้ำสำหรับรถคันเดียวกัน (fixed search_path)';

COMMENT ON FUNCTION public.validate_trip_odometer() IS 
  'Validate that odometer_end >= odometer_start (fixed search_path)';

COMMENT ON FUNCTION public.get_vehicle_status(uuid) IS 
  'คำนวณสถานะรถแบบ real-time จาก trip_logs (fixed search_path)';

-- ========================================
-- 3. NOTE ABOUT LEAKED PASSWORD PROTECTION
-- ========================================
-- 
-- The "Leaked Password Protection Disabled" warning is a Supabase Auth setting
-- that must be enabled in the Supabase Dashboard, not via SQL migration.
-- 
-- To enable:
-- 1. Go to Supabase Dashboard → Authentication → Settings
-- 2. Enable "Leaked Password Protection"
-- 3. This will check passwords against HaveIBeenPwned.org database
-- 
-- This migration only fixes the Function Search Path Mutable warnings.
-- ========================================

