-- Fix distance calculation in delivery_stats_by_day_vehicle
-- แก้ไขการคำนวณระยะทางในรายงานสรุปการส่งสินค้าตามรถ
-- 
-- ปัญหา:
-- 1. ระยะทางถูก SUM ซ้ำเมื่อทริปมีหลายร้าน (เพราะ JOIN กับ delivery_trip_stores)
-- 2. ไม่รองรับ manual_distance_km (จาก trip_logs)
-- 3. ไม่ใช้ distance_km จาก trip_logs ซึ่งคำนวณถูกต้องแล้ว
--
-- วิธีแก้:
-- 1. ใช้ subquery เพื่อคำนวณระยะทางต่อทริปก่อน แล้วค่อย aggregate
-- 2. ใช้ trip_logs.distance_km (รองรับ manual_distance_km)
-- 3. Fallback ไปใช้ delivery_trips.odometer_start/end ถ้าไม่มี trip_logs

-- Fix refresh_delivery_stats_by_day_vehicle function
-- แก้ไข: ใช้ CTE เพื่อคำนวณระยะทางต่อทริปก่อน แล้วค่อย aggregate
-- ใช้ SECURITY DEFINER เพื่อ bypass RLS policy สำหรับ INSERT/DELETE
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_vehicle(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- คำนวณข้อมูลใหม่โดยแยกการคำนวณระยะทางออกมาให้ชัดเจน
  -- ใช้ CTE เพื่อคำนวณระยะทางต่อทริปก่อน แล้วค่อย aggregate
  WITH trip_distances AS (
    -- คำนวณระยะทางต่อทริป (ไม่ซ้ำ - 1 row ต่อ 1 trip)
    SELECT
      dt.id AS trip_id,
      COALESCE(
        -- Priority 1: ใช้ trip_logs.distance_km (รองรับ manual_distance_km)
        (SELECT tl.distance_km 
         FROM public.trip_logs tl 
         WHERE tl.delivery_trip_id = dt.id 
         AND tl.status = 'checked_in' 
         AND tl.distance_km IS NOT NULL 
         LIMIT 1),
        -- Priority 2: คำนวณจาก odometer
        CASE 
          WHEN dt.odometer_end IS NOT NULL 
           AND dt.odometer_start IS NOT NULL 
           AND dt.odometer_end > dt.odometer_start
          THEN dt.odometer_end - dt.odometer_start
          ELSE 0
        END
      ) AS distance_km
    FROM public.delivery_trips dt
    WHERE dt.status = 'completed'
  ),
  trip_stats AS (
    -- คำนวณ stats ต่อทริป (ไม่ซ้ำ - 1 row ต่อ 1 trip)
    -- ใช้ subquery เพื่อไม่ให้นับซ้ำเมื่อทริปมีหลายร้าน
    SELECT
      dt.id AS trip_id,
      dt.vehicle_id,
      dt.planned_date,
      -- คำนวณ stores และ items ต่อทริป (ไม่ซ้ำ)
      (SELECT COUNT(DISTINCT dts2.store_id)
       FROM public.delivery_trip_stores dts2
       WHERE dts2.delivery_trip_id = dt.id) AS trip_stores,
      (SELECT COUNT(dti2.id)
       FROM public.delivery_trip_items dti2
       JOIN public.delivery_trip_stores dts2 ON dts2.id = dti2.delivery_trip_store_id
       WHERE dts2.delivery_trip_id = dt.id) AS trip_items,
      (SELECT COALESCE(SUM(dti2.quantity), 0)
       FROM public.delivery_trip_items dti2
       JOIN public.delivery_trip_stores dts2 ON dts2.id = dti2.delivery_trip_store_id
       WHERE dts2.delivery_trip_id = dt.id) AS trip_quantity,
      td.distance_km AS trip_distance_km
    FROM public.delivery_trips dt
    LEFT JOIN trip_distances td ON td.trip_id = dt.id
    WHERE dt.status = 'completed'
  ),
  trip_daily_mapping AS (
    -- Map trips to days based on store deliveries
    -- แต่ละทริปอาจปรากฏในหลายวันได้ (ถ้าร้านมี delivered_at ต่างกัน)
    -- แต่ระยะทางจะถูกนับเฉพาะครั้งเดียวต่อทริป (ใช้ MIN เพื่อเลือกวันที่แรก)
    SELECT DISTINCT
      ts.trip_id,
      ts.vehicle_id,
      ts.trip_stores,
      ts.trip_items,
      ts.trip_quantity,
      ts.trip_distance_km,
      -- ใช้ MIN ของ delivered_at หรือ planned_date เพื่อให้ทริปปรากฏแค่ 1 วัน
      -- ถ้ามี delivered_at ให้ใช้ MIN(delivered_at) มิฉะนั้นใช้ planned_date
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM public.delivery_trip_stores dts3 
          WHERE dts3.delivery_trip_id = ts.trip_id 
          AND dts3.delivered_at IS NOT NULL
        )
        THEN (
          SELECT MIN((COALESCE(dts3.delivered_at, ts.planned_date))::date)
          FROM public.delivery_trip_stores dts3
          WHERE dts3.delivery_trip_id = ts.trip_id
        )
        ELSE ts.planned_date::date
      END AS stat_date
    FROM trip_stats ts
    WHERE EXISTS (
      SELECT 1 FROM public.delivery_trip_stores dts4
      WHERE dts4.delivery_trip_id = ts.trip_id
      AND (COALESCE(dts4.delivered_at, ts.planned_date))::date BETWEEN v_start AND v_end
    )
  )
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
    stat_date,
    vehicle_id,
    COUNT(DISTINCT trip_id) AS total_trips,
    SUM(trip_stores) AS total_stores,  -- รวมจำนวนร้านทั้งหมด (ไม่ซ้ำแล้วเพราะแต่ละทริปมี 1 row)
    SUM(trip_items) AS total_items,    -- รวมจำนวนรายการสินค้าทั้งหมด
    SUM(trip_quantity) AS total_quantity,  -- รวมจำนวนสินค้าทั้งหมด
    SUM(trip_distance_km) AS total_distance_km,  -- รวมระยะทางของทริปทั้งหมด (ไม่ซ้ำแล้ว - แต่ละทริปถูกนับแค่ 1 ครั้งต่อวัน)
    now() AS created_at,
    now() AS updated_at
  FROM trip_daily_mapping
  GROUP BY
    stat_date,
    vehicle_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_vehicle(DATE, DATE) IS
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันตามรถ สำหรับช่วงวันที่ที่กำหนด (แก้ไข: ระยะทางไม่ซ้ำ + รองรับ manual_distance_km)';
