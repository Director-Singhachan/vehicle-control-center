-- ========================================
-- Create View for Staff Item Statistics
-- สถิติการยกสินค้าของพนักงานแต่ละคนในช่วงเวลาที่กำหนด
-- สำหรับแสดงในรายงาน
-- ========================================

-- View สำหรับสรุปสถิติการยกสินค้าของพนักงานแต่ละคนในช่วงเวลาที่กำหนด
CREATE OR REPLACE VIEW public.staff_item_statistics AS
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

-- ========================================
-- Function สำหรับดึงสถิติการยกสินค้าของพนักงานในช่วงเวลาที่กำหนด
-- ========================================
CREATE OR REPLACE FUNCTION public.get_staff_item_statistics(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  staff_code TEXT,
  staff_phone TEXT,
  staff_status TEXT,
  total_trips BIGINT,
  total_items_carried NUMERIC,
  completed_trips BIGINT,
  in_progress_trips BIGINT,
  planned_trips BIGINT,
  last_trip_date DATE,
  first_trip_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id as staff_id,
    ss.name as staff_name,
    ss.employee_code as staff_code,
    ss.phone as staff_phone,
    ss.status::TEXT as staff_status,
    
    COUNT(DISTINCT dt.id) as total_trips,
    
    SUM(
      CASE 
        WHEN dtc.status = 'active' THEN
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
    
    COUNT(DISTINCT CASE WHEN dt.status = 'completed' THEN dt.id END) as completed_trips,
    COUNT(DISTINCT CASE WHEN dt.status = 'in_progress' THEN dt.id END) as in_progress_trips,
    COUNT(DISTINCT CASE WHEN dt.status = 'planned' THEN dt.id END) as planned_trips,
    MAX(dt.planned_date) as last_trip_date,
    MIN(dt.planned_date) as first_trip_date

  FROM public.service_staff ss
  INNER JOIN public.delivery_trip_crews dtc ON ss.id = dtc.staff_id
  INNER JOIN public.delivery_trips dt ON dtc.delivery_trip_id = dt.id
  WHERE dtc.status = 'active'
    AND (start_date IS NULL OR dt.planned_date >= start_date)
    AND (end_date IS NULL OR dt.planned_date <= end_date)
  GROUP BY 
    ss.id,
    ss.name,
    ss.employee_code,
    ss.phone,
    ss.status
  ORDER BY total_items_carried DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Comments
-- ========================================
COMMENT ON VIEW public.staff_item_statistics IS 
'สรุปสถิติการยกสินค้าของพนักงานแต่ละคน (รวมทุกทริป)';

COMMENT ON FUNCTION public.get_staff_item_statistics IS 
'ดึงสถิติการยกสินค้าของพนักงานในช่วงเวลาที่กำหนด (start_date, end_date)';

-- ========================================
-- Grant permissions
-- ========================================
GRANT SELECT ON public.staff_item_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_item_statistics TO authenticated;

