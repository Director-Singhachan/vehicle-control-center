-- ========================================
-- Create View for Staff Item Distribution
-- คำนวณการกระจายสินค้าต่อพนักงานในแต่ละทริป
-- ========================================

-- View สำหรับคำนวณการกระจายสินค้าต่อพนักงานในแต่ละทริป
-- แสดงว่าพนักงานแต่ละคนควรยกสินค้าไปเท่าไร (หารจำนวนคนทั้งหมด)
CREATE OR REPLACE VIEW public.staff_item_distribution AS
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

-- ========================================
-- View สำหรับสรุปการกระจายสินค้าต่อพนักงาน (Aggregated)
-- แสดงสรุปว่าพนักงานแต่ละคนยกสินค้าทั้งหมดไปเท่าไร
-- สำหรับเปรียบเทียบว่าใครยกมากไป ใครยกน้อยไป
-- ========================================
CREATE OR REPLACE VIEW public.staff_item_distribution_summary AS
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

-- ========================================
-- View สำหรับสรุปการกระจายสินค้าตามชนิด (Product-based)
-- แสดงว่าสินค้าแต่ละชนิดถูกกระจายให้พนักงานกี่คน และคนละเท่าไร
-- ========================================
CREATE OR REPLACE VIEW public.product_distribution_by_trip AS
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

-- ========================================
-- Comments
-- ========================================
COMMENT ON VIEW public.staff_item_distribution IS 
'แสดงการกระจายสินค้าต่อพนักงานในแต่ละทริป โดยคำนวณว่าพนักงานแต่ละคนควรยกสินค้าไปเท่าไร (หารจำนวนคนทั้งหมด)';

COMMENT ON VIEW public.staff_item_distribution_summary IS 
'สรุปการกระจายสินค้าต่อพนักงาน แสดงว่าพนักงานแต่ละคนยกสินค้าทั้งหมดไปเท่าไร (รวมทุกชนิด)';

COMMENT ON VIEW public.product_distribution_by_trip IS 
'สรุปการกระจายสินค้าตามชนิด แสดงว่าสินค้าแต่ละชนิดถูกกระจายให้พนักงานกี่คน และคนละเท่าไร';

-- ========================================
-- Grant permissions
-- ========================================
GRANT SELECT ON public.staff_item_distribution TO authenticated;
GRANT SELECT ON public.staff_item_distribution_summary TO authenticated;
GRANT SELECT ON public.product_distribution_by_trip TO authenticated;

