-- Enhanced Similar Trips Function with Layout Similarity
-- เพิ่มคะแนนความคล้ายจากการจัดเรียงจริง (layout pattern) เข้าไปในการคำนวณคะแนน similarity
-- ถ่วงน้ำหนัก: 40% weight, 30% utilization, 30% layout pattern

-- First, create helper function for layout similarity
CREATE OR REPLACE FUNCTION calculate_layout_similarity(p_trip_a_id UUID, p_trip_b_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_layout_a_exists BOOLEAN;
    v_layout_b_exists BOOLEAN;
    v_pallet_a INTEGER;
    v_pallet_b INTEGER;
    v_pallet_similarity NUMERIC;
    v_item_similarity NUMERIC;
    v_weight_pattern_similarity NUMERIC;
BEGIN
    -- Check if both trips have layout data
    SELECT EXISTS(
        SELECT 1 FROM trip_packing_layout WHERE delivery_trip_id = p_trip_a_id LIMIT 1
    ) INTO v_layout_a_exists;
    
    SELECT EXISTS(
        SELECT 1 FROM trip_packing_layout WHERE delivery_trip_id = p_trip_b_id LIMIT 1
    ) INTO v_layout_b_exists;
    
    -- If either trip doesn't have layout, return 0 (no similarity data)
    IF NOT (v_layout_a_exists AND v_layout_b_exists) THEN
        RETURN 0;
    END IF;
    
    -- 1. Pallet count similarity (40% of layout score)
    SELECT COUNT(*) FILTER (WHERE position_type = 'pallet')
    INTO v_pallet_a
    FROM trip_packing_layout 
    WHERE delivery_trip_id = p_trip_a_id;
    
    SELECT COUNT(*) FILTER (WHERE position_type = 'pallet')
    INTO v_pallet_b
    FROM trip_packing_layout 
    WHERE delivery_trip_id = p_trip_b_id;
    
    -- Convert difference to similarity (0-1, where 1 = same pallet count)
    v_pallet_similarity := CASE
        WHEN v_pallet_a = 0 AND v_pallet_b = 0 THEN 1.0
        WHEN v_pallet_a = 0 OR v_pallet_b = 0 THEN 0.0
        ELSE 1.0 - ABS(v_pallet_a - v_pallet_b)::NUMERIC / GREATEST(v_pallet_a, v_pallet_b)
    END;
    
    -- 2. Item overlap similarity (40% of layout score) - Jaccard similarity
    SELECT 
        CASE 
            WHEN union_cnt = 0 THEN 0.0
            ELSE intersection_cnt::NUMERIC / union_cnt
        END
    INTO v_item_similarity
    FROM (
        SELECT
            (SELECT COUNT(*) FROM (
                SELECT DISTINCT ti.product_id
                FROM trip_packing_layout_items tpli
                JOIN trip_packing_layout tpl ON tpli.trip_packing_layout_id = tpl.id
                JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
                WHERE tpl.delivery_trip_id = p_trip_a_id
                INTERSECT
                SELECT DISTINCT ti.product_id
                FROM trip_packing_layout_items tpli
                JOIN trip_packing_layout tpl ON tpli.trip_packing_layout_id = tpl.id
                JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
                WHERE tpl.delivery_trip_id = p_trip_b_id
            ) i) AS intersection_cnt,
            (SELECT COUNT(*) FROM (
                SELECT DISTINCT ti.product_id
                FROM trip_packing_layout_items tpli
                JOIN trip_packing_layout tpl ON tpli.trip_packing_layout_id = tpl.id
                JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
                WHERE tpl.delivery_trip_id = p_trip_a_id
                UNION
                SELECT DISTINCT ti.product_id
                FROM trip_packing_layout_items tpli
                JOIN trip_packing_layout tpl ON tpli.trip_packing_layout_id = tpl.id
                JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
                WHERE tpl.delivery_trip_id = p_trip_b_id
            ) u) AS union_cnt
    ) counts;
    
    -- 3. Weight distribution pattern similarity (20% of layout score)
    -- Compare which pallets tend to hold heavy vs light items
    SELECT COALESCE(AVG(
        CASE 
            WHEN pw_a.total_weight IS NULL OR pw_b.total_weight IS NULL THEN 0.5
            WHEN GREATEST(pw_a.total_weight, pw_b.total_weight) = 0 THEN 1.0
            ELSE 1.0 - ABS(pw_a.total_weight - pw_b.total_weight) / GREATEST(pw_a.total_weight, pw_b.total_weight)
        END
    ), 1.0)
    INTO v_weight_pattern_similarity
    FROM (
        SELECT DISTINCT position_index
        FROM trip_packing_layout
        WHERE delivery_trip_id IN (p_trip_a_id, p_trip_b_id)
        AND position_type = 'pallet'
    ) all_positions
    LEFT JOIN (
        SELECT tpl.position_index, SUM(ti.quantity * COALESCE(p.weight_kg, 0)) as total_weight
        FROM trip_packing_layout tpl
        JOIN trip_packing_layout_items tpli ON tpl.id = tpli.trip_packing_layout_id
        JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
        JOIN products p ON ti.product_id = p.id
        WHERE tpl.delivery_trip_id = p_trip_a_id AND tpl.position_type = 'pallet'
        GROUP BY tpl.position_index
    ) pw_a ON pw_a.position_index = all_positions.position_index
    LEFT JOIN (
        SELECT tpl.position_index, SUM(ti.quantity * COALESCE(p.weight_kg, 0)) as total_weight
        FROM trip_packing_layout tpl
        JOIN trip_packing_layout_items tpli ON tpl.id = tpli.trip_packing_layout_id
        JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
        JOIN products p ON ti.product_id = p.id
        WHERE tpl.delivery_trip_id = p_trip_b_id AND tpl.position_type = 'pallet'
        GROUP BY tpl.position_index
    ) pw_b ON pw_b.position_index = all_positions.position_index;
    
    -- Combine all layout similarity factors
    RETURN (
        v_pallet_similarity * 0.4 +
        v_item_similarity * 0.4 +
        v_weight_pattern_similarity * 0.2
    );
END;
$$;

-- Enhanced get_similar_trips function with layout similarity
CREATE OR REPLACE FUNCTION public.get_similar_trips_enhanced(
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
  layout_similarity_score NUMERIC,
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
    -- แปลงเป็นคะแนน similarity 0-1 (ยิ่งมากยิ่งใกล้เคียง) - ถ่วงน้ำหนักใหม่
    (
      COALESCE(1.0 - COALESCE(s.weight_diff_ratio, 0.0), 0.0) * 0.4 +
      COALESCE(1.0 - COALESCE(s.util_diff_abs, 0.0) / 100.0, 0.0) * 0.3
    ) AS base_similarity_score
  FROM scored2 s
),
with_layout_similarity AS (
  SELECT
    f.*,
    -- เพิ่มคะแนนความคล้ายจาก layout pattern (30% ของคะแนนรวม)
    COALESCE(calculate_layout_similarity(
      -- ใช้ dummy trip ID สำหรับ current trip (จริงๆ ต้องส่ง current trip ID มาให้)
      '00000000-0000-0000-0000-000000000000'::UUID,
      f.id
    ), 0.0) AS layout_similarity_score
  FROM final_scored f
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
  -- คะแนนรวม: 70% base + 30% layout
  (base_similarity_score * 0.7 + layout_similarity_score * 0.3) AS similarity_score,
  layout_similarity_score,
  main_categories,
  store_ids
FROM with_layout_similarity
ORDER BY similarity_score DESC NULLS LAST, planned_date DESC
LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$ LANGUAGE sql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_layout_similarity TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_layout_similarity TO service_role;
GRANT EXECUTE ON FUNCTION get_similar_trips_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION get_similar_trips_enhanced TO service_role;
