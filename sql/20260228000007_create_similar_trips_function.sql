-- ========================================
-- Similar Trips Function
-- เลือกทริปที่มีลักษณะใกล้เคียงกับโหลดปัจจุบัน
-- ใช้สำหรับให้ backend ดึง "ทริปคล้ายกัน" 5–10 ทริป
-- เพื่อนำไปสรุปและส่งต่อให้ AI วิเคราะห์เป็น insight
-- ========================================

CREATE OR REPLACE FUNCTION public.get_similar_trips(
  p_current_weight_kg NUMERIC,
  p_current_volume_liter NUMERIC,
  p_store_ids UUID[] DEFAULT NULL,
  p_product_ids UUID[] DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  delivery_trip_id UUID,
  trip_number TEXT,
  vehicle_id UUID,
  vehicle_plate TEXT,
  planned_date DATE,
  actual_weight_kg NUMERIC,
  actual_pallets_used INTEGER,
  space_utilization_percent NUMERIC,
  had_packing_issues BOOLEAN,
  similarity_score NUMERIC,
  main_categories TEXT[],
  store_ids UUID[]
) AS $$
WITH candidate_trips AS (
  SELECT
    dt.id,
    dt.trip_number,
    dt.vehicle_id,
    v.plate AS vehicle_plate,
    dt.planned_date,
    dt.actual_weight_kg,
    dt.actual_pallets_used,
    dt.space_utilization_percent,
    dt.had_packing_issues,
    v.cargo_volume_liter
  FROM public.delivery_trips dt
  JOIN public.vehicles v ON v.id = dt.vehicle_id
  WHERE dt.status = 'completed'
    -- ใช้เฉพาะทริปที่มี metrics บางอย่างแล้ว
    AND (dt.actual_weight_kg IS NOT NULL OR dt.space_utilization_percent IS NOT NULL)
    -- จำกัดช่วงเวลา (เช่น 180 วันล่าสุด) เพื่อลด noise
    AND dt.planned_date >= (CURRENT_DATE - INTERVAL '180 days')
    -- ถ้าระบุ store_ids ให้เลือกเฉพาะทริปที่มีร้านซ้ำอย่างน้อย 1 ร้าน
    AND (
      p_store_ids IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.delivery_trip_stores dts
        WHERE dts.delivery_trip_id = dt.id
          AND dts.store_id = ANY(p_store_ids)
      )
    )
    -- ถ้าระบุ product_ids ให้เลือกเฉพาะทริปที่มีสินค้าอย่างน้อย 1 ตัวซ้ำกัน
    AND (
      p_product_ids IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.delivery_trip_items dti
        WHERE dti.delivery_trip_id = dt.id
          AND dti.product_id = ANY(p_product_ids)
      )
    )
),
trip_with_agg AS (
  SELECT
    c.*,
    -- หมวดหมู่สินค้าหลักในทริป
    (
      SELECT ARRAY(
        SELECT DISTINCT p.category
        FROM public.delivery_trip_items i
        JOIN public.products p ON p.id = i.product_id
        WHERE i.delivery_trip_id = c.id
      )
    ) AS main_categories,
    -- ร้านทั้งหมดในทริป
    (
      SELECT ARRAY(
        SELECT DISTINCT s.store_id
        FROM public.delivery_trip_stores s
        WHERE s.delivery_trip_id = c.id
      )
    ) AS store_ids
  FROM candidate_trips c
),
scored AS (
  SELECT
    t.*,
    -- ความต่างของน้ำหนัก (ในรูปแบบ 0-1, ยิ่งน้อยยิ่งดี)
    CASE
      WHEN p_current_weight_kg IS NULL OR p_current_weight_kg <= 0 OR t.actual_weight_kg IS NULL THEN NULL
      ELSE ABS(t.actual_weight_kg - p_current_weight_kg) / NULLIF(p_current_weight_kg, 0)
    END AS weight_diff_ratio,
    -- ประมาณ utilization ของโหลดปัจจุบันจากปริมาตรและความจุรถ
    CASE
      WHEN p_current_volume_liter IS NULL OR p_current_volume_liter <= 0
        OR t.cargo_volume_liter IS NULL OR t.cargo_volume_liter <= 0
      THEN NULL
      ELSE LEAST(100, (p_current_volume_liter / t.cargo_volume_liter) * 100.0)
    END AS current_util_estimate
  FROM trip_with_agg t
),
scored2 AS (
  SELECT
    s.*,
    -- ความต่างของ utilization (0-100, ยิ่งน้อยยิ่งดี)
    CASE
      WHEN s.space_utilization_percent IS NULL OR s.current_util_estimate IS NULL THEN NULL
      ELSE ABS(s.space_utilization_percent - s.current_util_estimate)
    END AS util_diff_abs
  FROM scored s
),
final_scored AS (
  SELECT
    s.*,
    -- แปลงเป็นคะแนน similarity 0-1 (ยิ่งมากยิ่งใกล้เคียง)
    (
      COALESCE(1.0 - COALESCE(s.weight_diff_ratio, 0.0), 0.0) * 0.6 +
      COALESCE(1.0 - COALESCE(s.util_diff_abs, 0.0) / 100.0, 0.0) * 0.4
    ) AS similarity_score
  FROM scored2 s
)
SELECT
  id AS delivery_trip_id,
  trip_number,
  vehicle_id,
  vehicle_plate,
  planned_date,
  actual_weight_kg,
  actual_pallets_used,
  space_utilization_percent,
  had_packing_issues,
  similarity_score,
  main_categories,
  store_ids
FROM final_scored
ORDER BY similarity_score DESC NULLS LAST, planned_date DESC
LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$ LANGUAGE sql STABLE;

