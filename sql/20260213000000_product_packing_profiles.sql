-- ============================================================
-- RPC: get_product_packing_profiles
-- สำหรับสินค้าแต่ละตัว (เฉพาะรถคันที่ระบุ):
--   ตำแหน่งพาเลทที่วางบ่อย, ชั้นที่วาง, จำนวนต่อพาเลท, สินค้าที่มักวางคู่
-- ============================================================

CREATE OR REPLACE FUNCTION get_product_packing_profiles(
  p_vehicle_id UUID,
  p_product_ids UUID[]
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  times_packed BIGINT,
  most_common_position INT,
  position_distribution JSONB,
  most_common_layer TEXT,
  layer_distribution JSONB,
  avg_qty_per_pallet NUMERIC,
  max_qty_per_pallet NUMERIC,
  top_copacked TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- =============================================
  -- Step 1: ดึง layout items ทั้งหมดของรถคันนี้ ที่ทริป completed
  -- =============================================
  base_data AS (
    SELECT
      dti.product_id AS pid,
      p.product_name AS pname,
      tpl.position_index,
      tpli.layer_index,
      tpli.quantity,
      tpl.total_layers,
      tpl.id AS layout_id,
      tpl.delivery_trip_id
    FROM trip_packing_layout_items tpli
    JOIN trip_packing_layout tpl ON tpli.trip_packing_layout_id = tpl.id
    JOIN delivery_trips dt ON tpl.delivery_trip_id = dt.id
    JOIN delivery_trip_items dti ON tpli.delivery_trip_item_id = dti.id
    JOIN products p ON dti.product_id = p.id
    WHERE dt.vehicle_id = p_vehicle_id
      AND dt.status = 'completed'
      AND dti.product_id = ANY(p_product_ids)
      AND tpl.position_type = 'pallet'
  ),

  -- =============================================
  -- Step 2: นับจำนวนครั้งที่ packed
  -- =============================================
  pack_counts AS (
    SELECT pid, pname, COUNT(*) AS cnt
    FROM base_data
    GROUP BY pid, pname
  ),

  -- =============================================
  -- Step 3: position distribution (% ต่อ position_index)
  -- =============================================
  pos_counts AS (
    SELECT pid, position_index, COUNT(*) AS cnt
    FROM base_data
    GROUP BY pid, position_index
  ),
  pos_total AS (
    SELECT pid, SUM(cnt) AS total FROM pos_counts GROUP BY pid
  ),
  pos_dist AS (
    SELECT
      pc.pid,
      jsonb_object_agg(
        pc.position_index::TEXT,
        ROUND((pc.cnt::NUMERIC / pt.total) * 100)
      ) AS dist,
      (ARRAY_AGG(pc.position_index ORDER BY pc.cnt DESC))[1] AS most_common
    FROM pos_counts pc
    JOIN pos_total pt ON pc.pid = pt.pid
    GROUP BY pc.pid
  ),

  -- =============================================
  -- Step 4: layer distribution (ล่าง/กลาง/บน)
  -- =============================================
  layer_labeled AS (
    SELECT
      pid,
      CASE
        WHEN layer_index IS NULL THEN 'ไม่ระบุชั้น'
        WHEN layer_index = 0 THEN 'ล่างสุด'
        WHEN total_layers IS NOT NULL AND layer_index >= total_layers - 1 THEN 'บนสุด'
        ELSE 'กลาง'
      END AS layer_label
    FROM base_data
  ),
  layer_counts AS (
    SELECT pid, layer_label, COUNT(*) AS cnt
    FROM layer_labeled
    GROUP BY pid, layer_label
  ),
  layer_total AS (
    SELECT pid, SUM(cnt) AS total FROM layer_counts GROUP BY pid
  ),
  layer_dist AS (
    SELECT
      lc.pid,
      jsonb_object_agg(
        lc.layer_label,
        ROUND((lc.cnt::NUMERIC / lt.total) * 100)
      ) AS dist,
      (ARRAY_AGG(lc.layer_label ORDER BY lc.cnt DESC))[1] AS most_common
    FROM layer_counts lc
    JOIN layer_total lt ON lc.pid = lt.pid
    GROUP BY lc.pid
  ),

  -- =============================================
  -- Step 5: ปริมาณต่อพาเลท (avg, max)
  -- =============================================
  qty_stats AS (
    SELECT
      pid,
      ROUND(AVG(quantity), 1) AS avg_qty,
      MAX(quantity) AS max_qty
    FROM base_data
    GROUP BY pid
  ),

  -- =============================================
  -- Step 6: co-packed products (top 3 สินค้าที่มักวางพาเลทเดียวกัน)
  -- =============================================
  copacked AS (
    SELECT
      b1.pid AS pid,
      p2.product_name AS copacked_name,
      COUNT(*) AS cnt
    FROM base_data b1
    JOIN trip_packing_layout_items tpli2
      ON tpli2.trip_packing_layout_id = (
        SELECT tpli_inner.trip_packing_layout_id
        FROM trip_packing_layout_items tpli_inner
        JOIN trip_packing_layout tpl_inner ON tpli_inner.trip_packing_layout_id = tpl_inner.id
        WHERE tpl_inner.id = (
          SELECT tpl2.id FROM trip_packing_layout tpl2
          JOIN trip_packing_layout_items tpli3 ON tpli3.trip_packing_layout_id = tpl2.id
          JOIN delivery_trip_items dti3 ON tpli3.delivery_trip_item_id = dti3.id
          WHERE tpl2.delivery_trip_id = b1.delivery_trip_id
            AND tpl2.position_index = b1.position_index
            AND dti3.product_id = b1.pid
          LIMIT 1
        )
      )
    JOIN delivery_trip_items dti2 ON tpli2.delivery_trip_item_id = dti2.id
    JOIN products p2 ON dti2.product_id = p2.id
    WHERE dti2.product_id != b1.pid
    GROUP BY b1.pid, p2.product_name
  ),
  copacked_ranked AS (
    SELECT
      pid,
      ARRAY_AGG(copacked_name ORDER BY cnt DESC) AS names
    FROM copacked
    GROUP BY pid
  )

  -- =============================================
  -- Final: รวมทุกอย่าง
  -- =============================================
  SELECT
    pc.pid AS product_id,
    pc.pname AS product_name,
    pc.cnt AS times_packed,
    COALESCE(pd.most_common, 1) AS most_common_position,
    COALESCE(pd.dist, '{}'::JSONB) AS position_distribution,
    COALESCE(ld.most_common, 'ไม่ระบุ') AS most_common_layer,
    COALESCE(ld.dist, '{}'::JSONB) AS layer_distribution,
    COALESCE(qs.avg_qty, 0) AS avg_qty_per_pallet,
    COALESCE(qs.max_qty, 0) AS max_qty_per_pallet,
    COALESCE(cr.names[1:3], ARRAY[]::TEXT[]) AS top_copacked
  FROM pack_counts pc
  LEFT JOIN pos_dist pd ON pc.pid = pd.pid
  LEFT JOIN layer_dist ld ON pc.pid = ld.pid
  LEFT JOIN qty_stats qs ON pc.pid = qs.pid
  LEFT JOIN copacked_ranked cr ON pc.pid = cr.pid
  ORDER BY pc.cnt DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_product_packing_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_packing_profiles TO service_role;
