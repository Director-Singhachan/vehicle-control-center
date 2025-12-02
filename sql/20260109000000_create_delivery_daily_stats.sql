-- Migration: Create daily delivery summary tables (vehicle / store / product)
-- เป้าหมาย: เตรียมโครงสำหรับรายงานความเร็วสูง รองรับข้อมูลจำนวนมาก

-- 1) สรุปรายวันตามรถ
CREATE TABLE IF NOT EXISTS public.delivery_stats_by_day_vehicle (
  stat_date DATE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  total_trips INTEGER NOT NULL DEFAULT 0,
  total_stores INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  total_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_distance_km NUMERIC(18, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stat_date, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_vehicle_date
  ON public.delivery_stats_by_day_vehicle(stat_date);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_vehicle_vehicle
  ON public.delivery_stats_by_day_vehicle(vehicle_id);

COMMENT ON TABLE public.delivery_stats_by_day_vehicle IS
  'สรุปการส่งสินค้ารายวันตามรถ (เตรียมไว้สำหรับรายงานความเร็วสูง)';


-- 2) สรุปรายวันตามร้าน
CREATE TABLE IF NOT EXISTS public.delivery_stats_by_day_store (
  stat_date DATE NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  total_trips INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  total_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stat_date, store_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_store_date
  ON public.delivery_stats_by_day_store(stat_date);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_store_store
  ON public.delivery_stats_by_day_store(store_id);

COMMENT ON TABLE public.delivery_stats_by_day_store IS
  'สรุปการส่งสินค้ารายวันตามร้านค้า';


-- 3) สรุปรายวันตามสินค้า
CREATE TABLE IF NOT EXISTS public.delivery_stats_by_day_product (
  stat_date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  total_trips INTEGER NOT NULL DEFAULT 0,
  total_stores INTEGER NOT NULL DEFAULT 0,
  total_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stat_date, product_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_product_date
  ON public.delivery_stats_by_day_product(stat_date);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_product_product
  ON public.delivery_stats_by_day_product(product_id);

COMMENT ON TABLE public.delivery_stats_by_day_product IS
  'สรุปการส่งสินค้ารายวันตามสินค้า';


-- 4) ฟังก์ชันสำหรับ refresh ข้อมูลสรุปรายวันตามรถ (incremental)
-- หมายเหตุ: ตอนนี้ยังไม่เชื่อมกับ frontend จะใช้สำหรับ batch job ภายหลัง
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_vehicle(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
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

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_vehicle(p_start_date DATE, p_end_date DATE) IS
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันตามรถ สำหรับช่วงวันที่ที่กำหนด (ใช้ใน batch job)';


-- 5) ฟังก์ชันสำหรับ refresh ข้อมูลสรุปรายวันตามร้าน
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_store(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
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

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_store(p_start_date DATE, p_end_date DATE) IS
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันตามร้านค้า สำหรับช่วงวันที่ที่กำหนด (ใช้ใน batch job)';


-- 6) ฟังก์ชันสำหรับ refresh ข้อมูลสรุปรายวันตามสินค้า
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_product(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
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

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_product(p_start_date DATE, p_end_date DATE) IS
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันตามสินค้า สำหรับช่วงวันที่ที่กำหนด (ใช้ใน batch job)';


