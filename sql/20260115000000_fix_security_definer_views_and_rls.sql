-- ========================================
-- Fix Security Definer Views and Enable RLS for Stats Tables
-- แก้ไข Security Definer Views และเปิด RLS สำหรับตารางสถิติ
-- ========================================
-- 
-- Issues Fixed:
-- 1. Remove SECURITY DEFINER from 5 views:
--    - tickets_with_relations
--    - vehicle_usage_daily
--    - vehicles_with_status
--    - delivery_trip_active_crews
--    - delivery_trip_crew_history
--
-- 2. Enable RLS and create policies for 4 stats tables:
--    - delivery_stats_by_day_vehicle
--    - delivery_stats_by_day_store
--    - delivery_stats_by_day_product
--    - delivery_stats_by_day_store_product
-- ========================================

-- ========================================
-- 1. FIX VIEWS: Remove SECURITY DEFINER
-- ========================================

-- 1.1 Fix tickets_with_relations view
DROP VIEW IF EXISTS public.tickets_with_relations CASCADE;
CREATE VIEW public.tickets_with_relations AS
SELECT 
  t.*,
  v.plate as vehicle_plate,
  v.make,
  v.model,
  v.type as vehicle_type,
  v.branch,
  v.image_url as vehicle_image_url,
  r.email as reporter_email,
  r.full_name as reporter_name,
  r.role as reporter_role
FROM public.tickets t
LEFT JOIN public.vehicles v ON t.vehicle_id = v.id
LEFT JOIN public.profiles r ON t.reporter_id = r.id;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.tickets_with_relations SET (security_invoker = true);

-- 1.2 Fix vehicle_usage_daily view
DROP VIEW IF EXISTS public.vehicle_usage_daily CASCADE;
CREATE VIEW public.vehicle_usage_daily AS
SELECT 
  date_trunc('day', tl.checkout_time)::date as day,
  COUNT(DISTINCT tl.vehicle_id) as active_vehicles,
  COUNT(*) as total_trips,
  SUM(COALESCE(tl.distance_km, 0)) as total_distance,
  AVG(COALESCE(tl.distance_km, 0)) as avg_distance,
  SUM(COALESCE(tl.duration_hours, 0)) as total_hours
FROM public.trip_logs tl
WHERE tl.status = 'checked_in'
  AND tl.checkout_time >= now() - interval '90 days'
GROUP BY date_trunc('day', tl.checkout_time)::date
ORDER BY day DESC;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.vehicle_usage_daily SET (security_invoker = true);

-- 1.3 Fix vehicles_with_status view
DROP VIEW IF EXISTS public.vehicles_with_status CASCADE;
CREATE VIEW public.vehicles_with_status AS
SELECT 
  v.*,
  public.get_vehicle_status(v.id) as status,
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

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.vehicles_with_status SET (security_invoker = true);

-- 1.4 Fix delivery_trip_active_crews view
DROP VIEW IF EXISTS public.delivery_trip_active_crews CASCADE;
CREATE VIEW public.delivery_trip_active_crews AS
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

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.delivery_trip_active_crews SET (security_invoker = true);

-- 1.5 Fix delivery_trip_crew_history view
DROP VIEW IF EXISTS public.delivery_trip_crew_history CASCADE;
CREATE VIEW public.delivery_trip_crew_history AS
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

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.delivery_trip_crew_history SET (security_invoker = true);

-- ========================================
-- 2. ENABLE RLS FOR STATS TABLES
-- ========================================

-- 2.1 Enable RLS for delivery_stats_by_day_vehicle
ALTER TABLE public.delivery_stats_by_day_vehicle ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read stats
-- Note: Write operations (INSERT/UPDATE/DELETE) are handled by functions
-- which use service_role and automatically bypass RLS
DROP POLICY IF EXISTS "delivery_stats_by_day_vehicle read" ON public.delivery_stats_by_day_vehicle;
CREATE POLICY "delivery_stats_by_day_vehicle read" ON public.delivery_stats_by_day_vehicle
  FOR SELECT
  TO authenticated
  USING (true);

-- 2.2 Enable RLS for delivery_stats_by_day_store
ALTER TABLE public.delivery_stats_by_day_store ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read stats
-- Note: Write operations (INSERT/UPDATE/DELETE) are handled by functions
-- which use service_role and automatically bypass RLS
DROP POLICY IF EXISTS "delivery_stats_by_day_store read" ON public.delivery_stats_by_day_store;
CREATE POLICY "delivery_stats_by_day_store read" ON public.delivery_stats_by_day_store
  FOR SELECT
  TO authenticated
  USING (true);

-- 2.3 Enable RLS for delivery_stats_by_day_product
ALTER TABLE public.delivery_stats_by_day_product ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read stats
-- Note: Write operations (INSERT/UPDATE/DELETE) are handled by functions
-- which use service_role and automatically bypass RLS
DROP POLICY IF EXISTS "delivery_stats_by_day_product read" ON public.delivery_stats_by_day_product;
CREATE POLICY "delivery_stats_by_day_product read" ON public.delivery_stats_by_day_product
  FOR SELECT
  TO authenticated
  USING (true);

-- 2.4 Enable RLS for delivery_stats_by_day_store_product
ALTER TABLE public.delivery_stats_by_day_store_product ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read stats
-- Note: Write operations (INSERT/UPDATE/DELETE) are handled by functions
-- which use service_role and automatically bypass RLS
DROP POLICY IF EXISTS "delivery_stats_by_day_store_product read" ON public.delivery_stats_by_day_store_product;
CREATE POLICY "delivery_stats_by_day_store_product read" ON public.delivery_stats_by_day_store_product
  FOR SELECT
  TO authenticated
  USING (true);

-- ========================================
-- 3. COMMENTS
-- ========================================

COMMENT ON VIEW public.tickets_with_relations IS 
  'View สำหรับแสดงข้อมูล tickets พร้อมข้อมูลที่เกี่ยวข้อง (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.vehicle_usage_daily IS 
  'View สำหรับแสดงสถิติการใช้งานรถรายวัน (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.vehicles_with_status IS 
  'View สำหรับแสดงข้อมูลรถพร้อมสถานะ (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.delivery_trip_active_crews IS 
  'View สำหรับแสดงพนักงานที่กำลังทำงานในทริป (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.delivery_trip_crew_history IS 
  'View สำหรับแสดงประวัติการเปลี่ยนแปลงพนักงานในทริป (ไม่มี SECURITY DEFINER)';

COMMENT ON POLICY "delivery_stats_by_day_vehicle read" ON public.delivery_stats_by_day_vehicle IS 
  'อนุญาตให้ผู้ใช้ที่ authenticated อ่านสถิติได้';

COMMENT ON POLICY "delivery_stats_by_day_store read" ON public.delivery_stats_by_day_store IS 
  'อนุญาตให้ผู้ใช้ที่ authenticated อ่านสถิติได้';

COMMENT ON POLICY "delivery_stats_by_day_product read" ON public.delivery_stats_by_day_product IS 
  'อนุญาตให้ผู้ใช้ที่ authenticated อ่านสถิติได้';

COMMENT ON POLICY "delivery_stats_by_day_store_product read" ON public.delivery_stats_by_day_store_product IS 
  'อนุญาตให้ผู้ใช้ที่ authenticated อ่านสถิติได้';

