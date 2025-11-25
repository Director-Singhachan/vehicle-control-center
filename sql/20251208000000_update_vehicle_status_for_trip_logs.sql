-- ========================================
-- Update Vehicle Status Function to Use trip_logs
-- อัปเดต function สำหรับคำนวณสถานะรถให้ใช้ trip_logs แทน vehicle_usage
-- ========================================

CREATE OR REPLACE FUNCTION public.get_vehicle_status(p_vehicle_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
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

-- อัปเดต view vehicles_with_status เพื่อใช้ trip_logs แทน vehicle_usage
CREATE OR REPLACE VIEW public.vehicles_with_status AS
SELECT 
  v.*,
  public.get_vehicle_status(v.id) as status,
  -- เพิ่มข้อมูลอื่นๆ ที่อาจมีประโยชน์
  (SELECT COUNT(*) 
   FROM public.trip_logs tl 
   WHERE tl.vehicle_id = v.id 
     AND tl.checkout_time >= now() - interval '30 days') as trips_last_30_days,
  (SELECT fr.fuel_efficiency 
   FROM public.fuel_records fr 
   WHERE fr.vehicle_id = v.id 
   ORDER BY fr.filled_at DESC 
   LIMIT 1) as last_fuel_efficiency
FROM public.vehicles v;

-- หมายเหตุ:
-- - Function นี้คำนวณสถานะรถแบบ real-time จาก trip_logs
-- - View นี้รวมข้อมูลรถพร้อม status
-- - Frontend สามารถ query จาก view นี้ได้เลย

