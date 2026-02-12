-- Packing Layout Analytics Queries
-- สร้างฟังก์ชันและวิวสำหรับวิเคราะห์ข้อมูลการจัดเรียงจริง
-- ใช้สำหรับ Packing Insights Dashboard (Phase D)

-- ========================================
-- 1. Product Affinity Analytics
-- สินค้าคู่ไหนมักถูกจัดเข้าพาเลทเดียวกันบ่อย
-- ========================================

CREATE OR REPLACE VIEW packing_product_affinity AS
WITH product_pairs AS (
  SELECT 
    dti1.product_id as product_a_id,
    dti2.product_id as product_b_id,
    COUNT(*) as cooccurrence_count,
    COUNT(DISTINCT tpl.id) as trip_count
  FROM trip_packing_layout tpl
  JOIN trip_packing_layout_items li1 ON tpl.id = li1.trip_packing_layout_id
  JOIN delivery_trip_items dti1 ON li1.delivery_trip_item_id = dti1.id
  JOIN trip_packing_layout_items li2 ON tpl.id = li2.trip_packing_layout_id
  JOIN delivery_trip_items dti2 ON li2.delivery_trip_item_id = dti2.id
  WHERE dti1.product_id < dti2.product_id  -- หลีกเลี่ยงนับคู่ซ้ำ
    AND li1.delivery_trip_item_id != li2.delivery_trip_item_id
  GROUP BY dti1.product_id, dti2.product_id
  HAVING COUNT(*) >= 3  -- แสดงเฉพาะคู่ที่เจอบ่อยๆ
),
product_names AS (
  SELECT 
    pp.product_a_id,
    pp.product_b_id,
    pp.cooccurrence_count,
    pp.trip_count,
    p1.product_name as product_a_name,
    p1.category as product_a_category,
    p2.product_name as product_b_name,
    p2.category as product_b_category,
    -- คำนวณ affinity score (ความถี่ / จำนวนทริปทั้งหมดที่มีสินค้าทั้งสอง)
    ROUND((pp.cooccurrence_count::NUMERIC / pp.trip_count::NUMERIC) * 100, 2) as affinity_percentage
  FROM product_pairs pp
  JOIN products p1 ON pp.product_a_id = p1.id
  JOIN products p2 ON pp.product_b_id = p2.id
)
SELECT 
  product_a_name || ' + ' || product_b_name as product_pair,
  product_a_category,
  product_b_category,
  cooccurrence_count,
  trip_count,
  affinity_percentage
FROM product_names
ORDER BY cooccurrence_count DESC, affinity_percentage DESC;

-- ========================================
-- 2. Weight Distribution Pattern Analytics
-- พาเลท 1 มักมีน้ำหนักเฉลี่ยกี่ kg (ของหนักล่าง)
-- ========================================

CREATE OR REPLACE VIEW pallet_weight_distribution AS
WITH pallet_weights AS (
  SELECT 
    tpl.position_index,
    tpl.position_type,
    SUM(ti.quantity * COALESCE(p.weight_kg, 0)) as total_weight_kg,
    COUNT(*) as item_count,
    -- จำแนกประเภทสินค้า (หนัก vs เบา)
    SUM(CASE WHEN p.weight_kg >= 5 THEN ti.quantity * COALESCE(p.weight_kg, 0) ELSE 0 END) as heavy_weight_kg,
    SUM(CASE WHEN p.weight_kg < 5 THEN ti.quantity * COALESCE(p.weight_kg, 0) ELSE 0 END) as light_weight_kg,
    COUNT(CASE WHEN p.weight_kg >= 5 THEN 1 END) as heavy_item_types,
    COUNT(CASE WHEN p.weight_kg < 5 THEN 1 END) as light_item_types
  FROM trip_packing_layout tpl
  JOIN trip_packing_layout_items tpli ON tpl.id = tpli.trip_packing_layout_id
  JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
  JOIN products p ON ti.product_id = p.id
  WHERE tpl.position_type = 'pallet'
  GROUP BY tpl.position_index, tpl.position_type
),
position_stats AS (
  SELECT 
    position_index,
    AVG(total_weight_kg) as avg_weight_kg,
    MIN(total_weight_kg) as min_weight_kg,
    MAX(total_weight_kg) as max_weight_kg,
    STDDEV(total_weight_kg) as stddev_weight_kg,
    COUNT(*) as pallet_count,
    AVG(heavy_weight_kg) as avg_heavy_weight_kg,
    AVG(light_weight_kg) as avg_light_weight_kg,
    AVG(heavy_item_types) as avg_heavy_item_types,
    AVG(light_item_types) as avg_light_item_types
  FROM pallet_weights
  GROUP BY position_index
)
SELECT 
  position_index,
  'พาเลท ' || position_index as pallet_position,
  ROUND(avg_weight_kg, 1) as avg_weight_kg,
  ROUND(min_weight_kg, 1) as min_weight_kg,
  ROUND(max_weight_kg, 1) as max_weight_kg,
  ROUND(stddev_weight_kg, 1) as stddev_weight_kg,
  pallet_count,
  ROUND(avg_heavy_weight_kg, 1) as avg_heavy_weight_kg,
  ROUND(avg_light_weight_kg, 1) as avg_light_weight_kg,
  ROUND(avg_heavy_item_types, 1) as avg_heavy_item_types,
  ROUND(avg_light_item_types, 1) as avg_light_item_types,
  -- Pattern analysis
  CASE 
    WHEN avg_heavy_weight_kg > avg_light_weight_kg THEN 'ของหนักหลัก'
    WHEN avg_light_weight_kg > avg_heavy_weight_kg THEN 'ของเบาหลัก'
    ELSE 'สมดุล'
  END as weight_pattern
FROM position_stats
ORDER BY position_index;

-- ========================================
-- 3. Packing Efficiency Trend Analysis
-- Space utilization ดีขึ้นหรือไม่เมื่อมีการบันทึก layout
-- ========================================

CREATE OR REPLACE VIEW packing_efficiency_trend AS
WITH monthly_metrics AS (
  SELECT 
    DATE_TRUNC('month', dt.planned_date) as month,
    COUNT(*) as total_trips,
    COUNT(CASE WHEN dt.had_packing_issues = true THEN 1 END) as trips_with_issues,
    AVG(dt.space_utilization_percent) as avg_utilization,
    AVG(dt.packing_efficiency_score) as avg_efficiency_score,
    COUNT(CASE WHEN tpl.id IS NOT NULL THEN 1 END) as trips_with_layout,
    -- คำนวณประสิทธิภาพเฉพาะทริปที่มี layout
    AVG(CASE WHEN tpl.id IS NOT NULL THEN dt.space_utilization_percent END) as avg_utilization_with_layout,
    AVG(CASE WHEN tpl.id IS NULL THEN dt.space_utilization_percent END) as avg_utilization_without_layout
  FROM delivery_trips dt
  LEFT JOIN trip_packing_layout tpl ON dt.id = tpl.delivery_trip_id
  WHERE dt.status = 'completed'
    AND dt.planned_date >= (CURRENT_DATE - INTERVAL '12 months')
  GROUP BY DATE_TRUNC('month', dt.planned_date)
),
trend_analysis AS (
  SELECT 
    month,
    total_trips,
    trips_with_issues,
    ROUND(avg_utilization, 1) as avg_utilization,
    ROUND(avg_efficiency_score, 1) as avg_efficiency_score,
    trips_with_layout,
    ROUND(avg_utilization_with_layout, 1) as avg_utilization_with_layout,
    ROUND(avg_utilization_without_layout, 1) as avg_utilization_without_layout,
    -- คำนวณอัตราการมีปัญหา
    ROUND((trips_with_issues::NUMERIC / total_trips::NUMERIC) * 100, 1) as issue_rate_percent,
    -- คำนวณอัตราการมี layout
    ROUND((trips_with_layout::NUMERIC / total_trips::NUMERIC) * 100, 1) as layout_adoption_rate,
    -- คำนวณผลต่างของ utilization ระหว่างมี/ไม่มี layout
    ROUND(avg_utilization_with_layout - avg_utilization_without_layout, 1) as utilization_gap
  FROM monthly_metrics
)
SELECT 
  TO_CHAR(month, 'YYYY-MM') as month_label,
  total_trips,
  trips_with_issues,
  avg_utilization,
  avg_efficiency_score,
  trips_with_layout,
  issue_rate_percent,
  layout_adoption_rate,
  utilization_gap,
  -- Trend indicators
  CASE 
    WHEN LAG(avg_utilization) OVER (ORDER BY month) IS NULL THEN 'N/A'
    WHEN avg_utilization > LAG(avg_utilization) OVER (ORDER BY month) THEN '↗️ ดีขึ้น'
    WHEN avg_utilization < LAG(avg_utilization) OVER (ORDER BY month) THEN '↘️ ลดลง'
    ELSE '→ คงที่'
  END as utilization_trend,
  CASE 
    WHEN LAG(issue_rate_percent) OVER (ORDER BY month) IS NULL THEN 'N/A'
    WHEN issue_rate_percent < LAG(issue_rate_percent) OVER (ORDER BY month) THEN '↗️ ดีขึ้น'
    WHEN issue_rate_percent > LAG(issue_rate_percent) OVER (ORDER BY month) THEN '↘️ ลดลง'
    ELSE '→ คงที่'
  END as issue_trend
FROM trend_analysis
ORDER BY month DESC;

-- ========================================
-- 4. Top Product Pairs Analytics
-- Top 10 product pairs มักจัดด้วยกัน
-- ========================================

CREATE OR REPLACE VIEW top_product_pairs AS
SELECT 
  product_pair,
  product_a_category || ' + ' || product_b_category as category_combination,
  cooccurrence_count,
  affinity_percentage,
  -- คำนวณ ranking
  ROW_NUMBER() OVER (ORDER BY cooccurrence_count DESC) as rank_by_frequency,
  ROW_NUMBER() OVER (ORDER BY affinity_percentage DESC) as rank_by_affinity
FROM packing_product_affinity
ORDER BY cooccurrence_count DESC
LIMIT 10;

-- ========================================
-- 5. Pallet Usage Analytics
-- กราฟแสดงการใช้พาเลทเฉลี่ย (avg, min, max) ต่อช่วงน้ำหนัก
-- ========================================

CREATE OR REPLACE VIEW pallet_usage_by_weight_range AS
WITH weight_ranges AS (
  SELECT 
    CASE 
      WHEN actual_weight_kg < 500 THEN '< 500 kg'
      WHEN actual_weight_kg < 1000 THEN '500-1000 kg'
      WHEN actual_weight_kg < 1500 THEN '1000-1500 kg'
      WHEN actual_weight_kg < 2000 THEN '1500-2000 kg'
      WHEN actual_weight_kg < 2500 THEN '2000-2500 kg'
      ELSE '> 2500 kg'
    END as weight_range,
    actual_pallets_used,
    actual_weight_kg,
    space_utilization_percent
  FROM delivery_trips
  WHERE status = 'completed'
    AND actual_weight_kg IS NOT NULL
    AND actual_pallets_used IS NOT NULL
),
range_stats AS (
  SELECT 
    weight_range,
    COUNT(*) as trip_count,
    AVG(actual_pallets_used) as avg_pallets,
    MIN(actual_pallets_used) as min_pallets,
    MAX(actual_pallets_used) as max_pallets,
    STDDEV(actual_pallets_used) as stddev_pallets,
    AVG(space_utilization_percent) as avg_utilization
  FROM weight_ranges
  GROUP BY weight_range
)
SELECT 
  weight_range,
  trip_count,
  ROUND(avg_pallets, 1) as avg_pallets,
  min_pallets,
  max_pallets,
  ROUND(stddev_pallets, 1) as stddev_pallets,
  ROUND(avg_utilization, 1) as avg_utilization,
  -- Efficiency indicator
  CASE 
    WHEN avg_pallets <= 2 THEN 'ประหยัดพาเลท'
    WHEN avg_pallets <= 4 THEN 'ปกติ'
    ELSE 'ใช้พาเลทมาก'
  END as efficiency_level
FROM range_stats
ORDER BY 
  CASE 
    WHEN weight_range = '< 500 kg' THEN 1
    WHEN weight_range = '500-1000 kg' THEN 2
    WHEN weight_range = '1000-1500 kg' THEN 3
    WHEN weight_range = '1500-2000 kg' THEN 4
    WHEN weight_range = '2000-2500 kg' THEN 5
    WHEN weight_range = '> 2500 kg' THEN 6
  END;

-- ========================================
-- 6. Layout Pattern Insights Summary
-- สรุปข้อมูล insights สำคัญสำหรับ dashboard
-- ========================================

CREATE OR REPLACE VIEW packing_insights_summary AS
WITH overall_stats AS (
  SELECT 
    COUNT(*) as total_completed_trips,
    COUNT(CASE WHEN tpl.id IS NOT NULL THEN 1 END) as trips_with_layout,
    AVG(dt.space_utilization_percent) as avg_utilization,
    AVG(dt.packing_efficiency_score) as avg_efficiency,
    COUNT(CASE WHEN dt.had_packing_issues = true THEN 1 END) as trips_with_issues,
    AVG(dt.actual_pallets_used) as avg_pallets_used
  FROM delivery_trips dt
  LEFT JOIN trip_packing_layout tpl ON dt.id = tpl.delivery_trip_id
  WHERE dt.status = 'completed'
    AND dt.planned_date >= (CURRENT_DATE - INTERVAL '90 days')
),
top_pairs AS (
  SELECT product_pair, cooccurrence_count
  FROM top_product_pairs
  LIMIT 3
),
pallet_patterns AS (
  SELECT 
    pallet_position,
    avg_weight_kg,
    weight_pattern
  FROM pallet_weight_distribution
  WHERE position_index <= 3  -- แสดงเฉพาะ 3 พาเลทแรก
)
SELECT 
  'Overall Performance' as metric_category,
  'Total Trips (90 days)' as metric_name,
  total_completed_trips::TEXT as metric_value,
  NULL as trend
FROM overall_stats

UNION ALL

SELECT 
  'Layout Adoption' as metric_category,
  'Trips with Layout' as metric_name,
  ROUND((trips_with_layout::NUMERIC / total_completed_trips::NUMERIC) * 100, 1) || '%' as metric_value,
  CASE 
    WHEN (trips_with_layout::NUMERIC / total_completed_trips::NUMERIC) >= 0.7 THEN 'Good'
    WHEN (trips_with_layout::NUMERIC / total_completed_trips::NUMERIC) >= 0.4 THEN 'Fair'
    ELSE 'Needs Improvement'
  END as trend
FROM overall_stats

UNION ALL

SELECT 
  'Efficiency' as metric_category,
  'Avg Space Utilization' as metric_name,
  ROUND(avg_utilization, 1) || '%' as metric_value,
  CASE 
    WHEN avg_utilization >= 80 THEN 'Excellent'
    WHEN avg_utilization >= 70 THEN 'Good'
    WHEN avg_utilization >= 60 THEN 'Fair'
    ELSE 'Poor'
  END as trend
FROM overall_stats

UNION ALL

SELECT 
  'Issues' as metric_category,
  'Issue Rate' as metric_name,
  ROUND((trips_with_issues::NUMERIC / total_completed_trips::NUMERIC) * 100, 1) || '%' as metric_value,
  CASE 
    WHEN (trips_with_issues::NUMERIC / total_completed_trips::NUMERIC) <= 0.1 THEN 'Excellent'
    WHEN (trips_with_issues::NUMERIC / total_completed_trips::NUMERIC) <= 0.2 THEN 'Good'
    WHEN (trips_with_issues::NUMERIC / total_completed_trips::NUMERIC) <= 0.3 THEN 'Fair'
    ELSE 'Poor'
  END as trend
FROM overall_stats

UNION ALL

SELECT 
  'Pallet Usage' as metric_category,
  'Avg Pallets per Trip' as metric_name,
  ROUND(avg_pallets_used, 1)::TEXT as metric_value,
  CASE 
    WHEN avg_pallets_used <= 2 THEN 'Efficient'
    WHEN avg_pallets_used <= 4 THEN 'Normal'
    ELSE 'High Usage'
  END as trend
FROM overall_stats

UNION ALL

SELECT 
  'Top Product Pairs' as metric_category,
  'Most Frequent Pair' as metric_name,
  product_pair as metric_value,
  cooccurrence_count || ' trips' as trend
FROM top_pairs
WHERE product_pair IS NOT NULL
LIMIT 1;

-- Grant permissions for analytics views
GRANT SELECT ON packing_product_affinity TO authenticated;
GRANT SELECT ON pallet_weight_distribution TO authenticated;
GRANT SELECT ON packing_efficiency_trend TO authenticated;
GRANT SELECT ON top_product_pairs TO authenticated;
GRANT SELECT ON pallet_usage_by_weight_range TO authenticated;
GRANT SELECT ON packing_insights_summary TO authenticated;
