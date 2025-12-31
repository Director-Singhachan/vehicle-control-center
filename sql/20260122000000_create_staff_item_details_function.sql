-- ========================================
-- Create Function for Staff Item Details
-- รายละเอียดการยกสินค้าของพนักงานแต่ละคนแบบละเอียด
-- ========================================

-- Function สำหรับดึงรายละเอียดการยกสินค้าของพนักงานแต่ละคนในช่วงเวลาที่กำหนด
-- แสดงว่าพนักงานแต่ละคนยกสินค้าแต่ละชนิดไปเท่าไร
CREATE OR REPLACE FUNCTION public.get_staff_item_details(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  staff_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  staff_code TEXT,
  staff_phone TEXT,
  staff_status TEXT,
  delivery_trip_id UUID,
  trip_number TEXT,
  planned_date DATE,
  product_id UUID,
  product_code TEXT,
  product_name TEXT,
  category TEXT,
  unit TEXT,
  total_quantity NUMERIC,
  quantity_per_staff NUMERIC,
  store_name TEXT,
  store_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id as staff_id,
    ss.name as staff_name,
    ss.employee_code as staff_code,
    ss.phone as staff_phone,
    ss.status::TEXT as staff_status,
    dt.id as delivery_trip_id,
    dt.trip_number,
    dt.planned_date,
    p.id as product_id,
    p.product_code,
    p.product_name,
    p.category,
    p.unit,
    dti.quantity as total_quantity,
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
    s.customer_name as store_name,
    s.customer_code as store_code

  FROM public.service_staff ss
  INNER JOIN public.delivery_trip_crews dtc ON ss.id = dtc.staff_id
  INNER JOIN public.delivery_trips dt ON dtc.delivery_trip_id = dt.id
  INNER JOIN public.delivery_trip_items dti ON dt.id = dti.delivery_trip_id
  INNER JOIN public.products p ON dti.product_id = p.id
  LEFT JOIN public.delivery_trip_stores dts ON dti.delivery_trip_store_id = dts.id
  LEFT JOIN public.stores s ON dts.store_id = s.id
  WHERE dtc.status = 'active'
    AND (start_date IS NULL OR dt.planned_date >= start_date)
    AND (end_date IS NULL OR dt.planned_date <= end_date)
    AND (staff_id_param IS NULL OR ss.id = staff_id_param)
  ORDER BY ss.name, dt.planned_date DESC, p.product_name;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Comments
-- ========================================
COMMENT ON FUNCTION public.get_staff_item_details IS 
'ดึงรายละเอียดการยกสินค้าของพนักงานแต่ละคนแบบละเอียด แสดงว่าพนักงานแต่ละคนยกสินค้าแต่ละชนิดไปเท่าไร';

-- ========================================
-- Grant permissions
-- ========================================
GRANT EXECUTE ON FUNCTION public.get_staff_item_details TO authenticated;

