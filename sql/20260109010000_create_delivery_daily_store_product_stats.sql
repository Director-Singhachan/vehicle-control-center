-- Migration: Create daily delivery stats by store & product
-- ตารางสรุปรายวันระดับ (ร้าน + สินค้า) เพื่อใช้เร่งรายงานตามร้าน / ตามสินค้า

CREATE TABLE IF NOT EXISTS public.delivery_stats_by_day_store_product (
  stat_date DATE NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  total_deliveries INTEGER NOT NULL DEFAULT 0, -- จำนวนครั้งที่มีรายการสินค้านี้ในร้านนี้ในวันนั้น
  total_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stat_date, store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_store_product_date
  ON public.delivery_stats_by_day_store_product(stat_date);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_store_product_store
  ON public.delivery_stats_by_day_store_product(store_id);

CREATE INDEX IF NOT EXISTS idx_delivery_stats_by_day_store_product_product
  ON public.delivery_stats_by_day_store_product(product_id);

COMMENT ON TABLE public.delivery_stats_by_day_store_product IS
  'สรุปการส่งสินค้ารายวันระดับร้าน + สินค้า ใช้เร่งรายงานตามร้าน/ตามสินค้า';


-- ฟังก์ชันสำหรับ refresh ข้อมูลสรุปรายวันระดับร้าน+สินค้า
CREATE OR REPLACE FUNCTION public.refresh_delivery_stats_by_day_store_product(p_start_date DATE, p_end_date DATE)
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

COMMENT ON FUNCTION public.refresh_delivery_stats_by_day_store_product(p_start_date DATE, p_end_date DATE) IS
  'คำนวณ/รีเฟรชข้อมูลสรุปรายวันระดับร้าน+สินค้า สำหรับช่วงวันที่ที่กำหนด (ใช้ใน batch job)';


