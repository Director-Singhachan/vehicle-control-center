-- ========================================
-- Fix Remaining Security Definer Views
-- แก้ไข Security Definer Views ที่เหลือ (8 views)
-- ========================================
-- 
-- Issues Fixed:
-- Remove SECURITY DEFINER from 8 views:
--   1. staff_item_distribution_summary
--   2. staff_item_statistics
--   3. product_distribution_by_trip
--   4. orders_with_details
--   5. product_prices_summary
--   6. pending_orders
--   7. staff_item_distribution
--   8. inventory_with_details
-- ========================================

-- ========================================
-- 1. Fix staff_item_distribution view
-- ========================================
DROP VIEW IF EXISTS public.staff_item_distribution CASCADE;
CREATE VIEW public.staff_item_distribution AS
SELECT 
  dt.id as delivery_trip_id,
  dt.trip_number,
  dt.planned_date,
  
  -- ข้อมูลพนักงาน
  dtc.id as crew_id,
  dtc.staff_id,
  ss.employee_code as staff_code,
  ss.name as staff_name,
  ss.phone as staff_phone,
  dtc.role as staff_role, -- 'driver' or 'helper'
  
  -- ข้อมูลสินค้า
  dti.id as item_id,
  dti.product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit,
  dti.quantity as total_quantity, -- จำนวนสินค้าทั้งหมดในทริปนี้ (แต่ละชนิด)
  dti.delivery_trip_store_id,
  dts.store_id,
  s.customer_name as store_name,
  s.customer_code as store_code,
  
  -- คำนวณจำนวนพนักงานทั้งหมดในทริป (รวมคนขับ)
  (
    SELECT COUNT(*)::DECIMAL
    FROM public.delivery_trip_crews dtc2
    WHERE dtc2.delivery_trip_id = dt.id
      AND dtc2.status = 'active'
  ) as total_staff_count,
  
  -- คำนวณจำนวนสินค้าต่อพนักงาน (หารจำนวนคน)
  -- ถ้ามีพนักงาน 4 คน และสินค้า 100 ชิ้น = 100/4 = 25 ชิ้นต่อคน
  CASE 
    WHEN (
      SELECT COUNT(*)::DECIMAL
      FROM public.delivery_trip_crews dtc2
      WHERE dtc2.delivery_trip_id = dt.id
        AND dtc2.status = 'active'
    ) > 0
    THEN ROUND(
      dti.quantity / (
        SELECT COUNT(*)::DECIMAL
        FROM public.delivery_trip_crews dtc2
        WHERE dtc2.delivery_trip_id = dt.id
          AND dtc2.status = 'active'
      ),
      2
    )
    ELSE 0
  END as quantity_per_staff,
  
  -- ข้อมูลเพิ่มเติม
  dti.notes as item_notes,
  dtc.start_at as staff_start_at,
  dtc.status as crew_status
  
FROM public.delivery_trips dt
INNER JOIN public.delivery_trip_crews dtc ON dt.id = dtc.delivery_trip_id
INNER JOIN public.service_staff ss ON dtc.staff_id = ss.id
INNER JOIN public.delivery_trip_items dti ON dt.id = dti.delivery_trip_id
INNER JOIN public.products p ON dti.product_id = p.id
LEFT JOIN public.delivery_trip_stores dts ON dti.delivery_trip_store_id = dts.id
LEFT JOIN public.stores s ON dts.store_id = s.id
WHERE dtc.status = 'active' -- เฉพาะพนักงานที่ active
ORDER BY dt.planned_date DESC, dt.trip_number, ss.name, p.product_name;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.staff_item_distribution SET (security_invoker = true);

-- ========================================
-- 2. Fix staff_item_distribution_summary view
-- ========================================
DROP VIEW IF EXISTS public.staff_item_distribution_summary CASCADE;
CREATE VIEW public.staff_item_distribution_summary AS
SELECT 
  delivery_trip_id,
  trip_number,
  planned_date,
  crew_id,
  staff_id,
  staff_code,
  staff_name,
  staff_phone,
  staff_role,
  crew_status,
  staff_start_at,
  
  -- สรุปจำนวนสินค้าทั้งหมดที่พนักงานคนนี้ต้องยก (รวมทุกชนิด)
  SUM(total_quantity) as total_items_to_carry,
  
  -- สรุปจำนวนสินค้าต่อพนักงาน (รวมทุกชนิด) - นี่คือตัวเลขสำคัญสำหรับเปรียบเทียบ
  SUM(quantity_per_staff) as total_items_per_staff,
  
  -- จำนวนพนักงานทั้งหมดในทริป (สำหรับคำนวณค่าเฉลี่ย)
  MAX(total_staff_count) as total_staff_count,
  
  -- ค่าเฉลี่ยการยกสินค้าต่อคนในทริปนี้ (สำหรับเปรียบเทียบ)
  AVG(SUM(quantity_per_staff)) OVER (PARTITION BY delivery_trip_id) as avg_items_per_staff_in_trip,
  
  -- จำนวนชนิดสินค้าที่แตกต่างกัน
  COUNT(DISTINCT product_id) as distinct_product_count,
  
  -- จำนวนร้านที่ต้องส่ง
  COUNT(DISTINCT store_id) as distinct_store_count
  
FROM public.staff_item_distribution
GROUP BY 
  delivery_trip_id,
  trip_number,
  planned_date,
  crew_id,
  staff_id,
  staff_code,
  staff_name,
  staff_phone,
  staff_role,
  crew_status,
  staff_start_at
ORDER BY planned_date DESC, trip_number, total_items_per_staff DESC;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.staff_item_distribution_summary SET (security_invoker = true);

-- ========================================
-- 3. Fix staff_item_statistics view
-- ========================================
DROP VIEW IF EXISTS public.staff_item_statistics CASCADE;
CREATE VIEW public.staff_item_statistics AS
SELECT 
  ss.id as staff_id,
  ss.name as staff_name,
  ss.employee_code as staff_code,
  ss.phone as staff_phone,
  ss.status as staff_status,
  
  -- สรุปจำนวนทริปที่พนักงานคนนี้ไป
  COUNT(DISTINCT dt.id) as total_trips,
  
  -- สรุปจำนวนสินค้าทั้งหมดที่พนักงานคนนี้ต้องยก (รวมทุกทริป)
  SUM(
    CASE 
      WHEN dtc.status = 'active' AND dtc.role = 'helper' THEN
        -- สำหรับ helper: หารจำนวนคนทั้งหมด
        COALESCE(
          (SELECT SUM(dti.quantity)
           FROM public.delivery_trip_items dti
           WHERE dti.delivery_trip_id = dt.id) / 
          NULLIF(
            (SELECT COUNT(*)::DECIMAL
             FROM public.delivery_trip_crews dtc2
             WHERE dtc2.delivery_trip_id = dt.id
               AND dtc2.status = 'active'), 0
          ),
          0
        )
      WHEN dtc.status = 'active' AND dtc.role = 'driver' THEN
        -- สำหรับ driver: หารจำนวนคนทั้งหมด (รวมคนขับ)
        COALESCE(
          (SELECT SUM(dti.quantity)
           FROM public.delivery_trip_items dti
           WHERE dti.delivery_trip_id = dt.id) / 
          NULLIF(
            (SELECT COUNT(*)::DECIMAL
             FROM public.delivery_trip_crews dtc2
             WHERE dtc2.delivery_trip_id = dt.id
               AND dtc2.status = 'active'), 0
          ),
          0
        )
      ELSE 0
    END
  ) as total_items_carried,
  
  -- จำนวนทริปที่เสร็จแล้ว
  COUNT(DISTINCT CASE WHEN dt.status = 'completed' THEN dt.id END) as completed_trips,
  
  -- จำนวนทริปที่กำลังดำเนินการ
  COUNT(DISTINCT CASE WHEN dt.status = 'in_progress' THEN dt.id END) as in_progress_trips,
  
  -- จำนวนทริปที่วางแผนไว้
  COUNT(DISTINCT CASE WHEN dt.status = 'planned' THEN dt.id END) as planned_trips,
  
  -- วันที่ทริปล่าสุด
  MAX(dt.planned_date) as last_trip_date,
  
  -- วันที่ทริปแรก
  MIN(dt.planned_date) as first_trip_date

FROM public.service_staff ss
INNER JOIN public.delivery_trip_crews dtc ON ss.id = dtc.staff_id
INNER JOIN public.delivery_trips dt ON dtc.delivery_trip_id = dt.id
WHERE dtc.status = 'active'
GROUP BY 
  ss.id,
  ss.name,
  ss.employee_code,
  ss.phone,
  ss.status;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.staff_item_statistics SET (security_invoker = true);

-- ========================================
-- 4. Fix product_distribution_by_trip view
-- ========================================
DROP VIEW IF EXISTS public.product_distribution_by_trip CASCADE;
CREATE VIEW public.product_distribution_by_trip AS
SELECT 
  dt.id as delivery_trip_id,
  dt.trip_number,
  dt.planned_date,
  dti.product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit,
  
  -- จำนวนสินค้าทั้งหมด (แต่ละชนิด) - SUM จาก delivery_trip_items โดยตรง
  SUM(dti.quantity) as total_quantity,
  
  -- จำนวนพนักงานทั้งหมดในทริป
  (
    SELECT COUNT(*)::DECIMAL
    FROM public.delivery_trip_crews dtc
    WHERE dtc.delivery_trip_id = dt.id
      AND dtc.status = 'active'
  ) as total_staff_count,
  
  -- จำนวนสินค้าต่อพนักงาน (หารจำนวนคน)
  CASE 
    WHEN (
      SELECT COUNT(*)::DECIMAL
      FROM public.delivery_trip_crews dtc
      WHERE dtc.delivery_trip_id = dt.id
        AND dtc.status = 'active'
    ) > 0
    THEN ROUND(
      SUM(dti.quantity) / (
        SELECT COUNT(*)::DECIMAL
        FROM public.delivery_trip_crews dtc
        WHERE dtc.delivery_trip_id = dt.id
          AND dtc.status = 'active'
      ),
      2
    )
    ELSE 0
  END as quantity_per_staff,
  
  -- จำนวนร้านที่ส่งสินค้านี้
  COUNT(DISTINCT dts.store_id) as store_count
  
FROM public.delivery_trips dt
INNER JOIN public.delivery_trip_items dti ON dt.id = dti.delivery_trip_id
INNER JOIN public.products p ON dti.product_id = p.id
LEFT JOIN public.delivery_trip_stores dts ON dti.delivery_trip_store_id = dts.id
GROUP BY 
  dt.id,
  dt.trip_number,
  dt.planned_date,
  dti.product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit
ORDER BY dt.planned_date DESC, dt.trip_number, p.product_name;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.product_distribution_by_trip SET (security_invoker = true);

-- ========================================
-- 5. Fix orders_with_details view
-- ========================================
DROP VIEW IF EXISTS public.orders_with_details CASCADE;
CREATE VIEW public.orders_with_details AS
SELECT 
  o.*,
  s.customer_code,
  s.customer_name,
  s.address as store_address,
  s.phone as store_phone,
  ct.tier_code,
  ct.tier_name,
  ct.color as tier_color,
  dt.trip_number,
  dt.status as trip_status,
  dt.planned_date as trip_date,
  creator.full_name as created_by_name,
  confirmer.full_name as confirmed_by_name,
  -- นับจำนวนรายการสินค้า
  (SELECT COUNT(*) FROM public.order_items WHERE order_id = o.id) as items_count,
  -- นับจำนวนสินค้าทั้งหมด
  (SELECT COALESCE(SUM(quantity), 0) FROM public.order_items WHERE order_id = o.id) as total_quantity
FROM public.orders o
LEFT JOIN public.stores s ON o.store_id = s.id
LEFT JOIN public.customer_tiers ct ON s.tier_id = ct.id
LEFT JOIN public.delivery_trips dt ON o.delivery_trip_id = dt.id
LEFT JOIN public.profiles creator ON o.created_by = creator.id
LEFT JOIN public.profiles confirmer ON o.confirmed_by = confirmer.id;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.orders_with_details SET (security_invoker = true);

-- ========================================
-- 6. Fix pending_orders view
-- ========================================
DROP VIEW IF EXISTS public.pending_orders CASCADE;
CREATE VIEW public.pending_orders AS
SELECT *
FROM public.orders_with_details
WHERE status IN ('confirmed')
  AND delivery_trip_id IS NULL
ORDER BY order_date, created_at;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.pending_orders SET (security_invoker = true);

-- ========================================
-- 7. Fix product_prices_summary view
-- ========================================
DROP VIEW IF EXISTS public.product_prices_summary CASCADE;
CREATE VIEW public.product_prices_summary AS
SELECT 
  p.id as product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit,
  p.base_price,
  p.cost_per_unit,
  ct.tier_code,
  ct.tier_name,
  ptp.price as tier_price,
  ptp.min_quantity,
  ptp.effective_from,
  ptp.effective_to,
  ptp.is_active as price_active,
  ROUND((ptp.price - p.cost_per_unit) / NULLIF(ptp.price, 0) * 100, 2) as margin_percent
FROM public.products p
LEFT JOIN public.product_tier_prices ptp ON p.id = ptp.product_id
LEFT JOIN public.customer_tiers ct ON ptp.tier_id = ct.id
WHERE p.is_active = true
ORDER BY p.product_code, ct.display_order;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.product_prices_summary SET (security_invoker = true);

-- ========================================
-- 8. Fix inventory_with_details view
-- ========================================
DROP VIEW IF EXISTS public.inventory_with_details CASCADE;
CREATE VIEW public.inventory_with_details AS
SELECT
  i.id,
  i.warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  w.type AS warehouse_type,
  i.product_id,
  p.product_code,
  p.product_name,
  p.category,
  p.unit,
  p.base_price,
  i.quantity,
  i.reserved_quantity,
  i.available_quantity,
  i.last_updated_at,
  i.created_at,
  CASE
    WHEN i.available_quantity <= 0 THEN 'out_of_stock'
    WHEN i.available_quantity <= COALESCE(i.min_stock_level, 0) THEN 'low_stock'
    WHEN i.max_stock_level IS NOT NULL AND i.quantity >= i.max_stock_level THEN 'overstock'
    ELSE 'in_stock'
  END AS stock_status
FROM public.inventory i
LEFT JOIN public.warehouses w ON i.warehouse_id = w.id
LEFT JOIN public.products p ON i.product_id = p.id
WHERE p.is_active = TRUE;

-- Explicitly remove SECURITY DEFINER property
ALTER VIEW public.inventory_with_details SET (security_invoker = true);

-- ========================================
-- Grant Permissions
-- ========================================
GRANT SELECT ON public.staff_item_distribution TO authenticated;
GRANT SELECT ON public.staff_item_distribution_summary TO authenticated;
GRANT SELECT ON public.staff_item_statistics TO authenticated;
GRANT SELECT ON public.product_distribution_by_trip TO authenticated;
GRANT SELECT ON public.orders_with_details TO authenticated;
GRANT SELECT ON public.pending_orders TO authenticated;
GRANT SELECT ON public.product_prices_summary TO authenticated;
GRANT SELECT ON public.inventory_with_details TO authenticated;

-- ========================================
-- Comments
-- ========================================
COMMENT ON VIEW public.staff_item_distribution IS 
'แสดงการกระจายสินค้าต่อพนักงานในแต่ละทริป โดยคำนวณว่าพนักงานแต่ละคนควรยกสินค้าไปเท่าไร (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.staff_item_distribution_summary IS 
'สรุปการกระจายสินค้าต่อพนักงาน แสดงว่าพนักงานแต่ละคนยกสินค้าทั้งหมดไปเท่าไร (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.staff_item_statistics IS 
'สรุปสถิติการยกสินค้าของพนักงานแต่ละคน (รวมทุกทริป) (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.product_distribution_by_trip IS 
'สรุปการกระจายสินค้าตามชนิด แสดงว่าสินค้าแต่ละชนิดถูกกระจายให้พนักงานกี่คน และคนละเท่าไร (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.orders_with_details IS 
'แสดงออเดอร์พร้อมรายละเอียดที่เกี่ยวข้อง (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.pending_orders IS 
'ออเดอร์ที่รอจัดทริป (status = confirmed และไม่มี delivery_trip_id) (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.product_prices_summary IS 
'แสดงราคาสินค้าทั้งหมดพร้อมราคาตาม tier (ไม่มี SECURITY DEFINER)';

COMMENT ON VIEW public.inventory_with_details IS 
'สต็อกสินค้าพร้อมรายละเอียด (ไม่มี SECURITY DEFINER)';

