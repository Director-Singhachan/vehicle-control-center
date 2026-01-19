-- ========================================
-- Backfill Missing Order Numbers
-- Migration: 20260204000002_backfill_missing_order_numbers.sql
-- ========================================
-- อัพเดท order_number ให้กับออเดอร์ที่ยังไม่มีเลขกำกับ
-- รูปแบบ:
--   - สาขา: I1+YYMMDD+เลขที่บิล (เช่น I1260118001)
--   - สำนักงานใหญ่: I0+YYMMDD+เลขที่บิล (เช่น I025012501)
-- ========================================

-- Function สำหรับสร้าง order_number ตามรูปแบบใหม่
CREATE OR REPLACE FUNCTION generate_backfill_order_number(
  p_order_id UUID,
  p_warehouse_id UUID DEFAULT NULL,
  p_order_date DATE DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_warehouse_type TEXT;
  v_warehouse_code TEXT;
  v_order_date DATE;
  v_year TEXT;
  v_month TEXT;
  v_day TEXT;
  v_date_prefix TEXT;
  v_last_number INTEGER;
  v_new_number TEXT;
  v_prefix TEXT;
BEGIN
  -- ใช้ order_date จาก parameter หรือจากตาราง
  IF p_order_date IS NULL THEN
    SELECT order_date INTO v_order_date
    FROM public.orders
    WHERE id = p_order_id;
  ELSE
    v_order_date := p_order_date;
  END IF;
  
  -- ตรวจสอบ warehouse type
  IF p_warehouse_id IS NOT NULL THEN
    SELECT type, code INTO v_warehouse_type, v_warehouse_code
    FROM public.warehouses
    WHERE id = p_warehouse_id;
  END IF;
  
  -- สร้าง date prefix: YYMMDD
  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;
  
  -- ถ้าเป็นสาขา ใช้รูปแบบ I1+YYMMDD+เลขที่บิล (เช่น I1260118001)
  -- แต่ต้องตรวจสอบว่าเลขที่บิลในวันเดียวกันยังไม่ซ้ำ
  IF v_warehouse_type = 'branch' THEN
    -- หาเลขที่บิลล่าสุดในวันเดียวกันสำหรับสาขานี้
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(
            order_number 
            FROM 'I1' || v_date_prefix || '([0-9]+)$'
          ) AS INTEGER
        )
      ),
      0
    ) INTO v_last_number
    FROM public.orders
    WHERE order_number ~ ('^I1' || v_date_prefix || '[0-9]+$')
      AND order_number IS NOT NULL
      AND warehouse_id = p_warehouse_id
      AND order_date = p_order_date;
    
    -- สร้างเลขใหม่: I1+YYMMDD+เลขที่บิล (3 หลัก) สำหรับสาขา
    v_new_number := 'I1' || v_date_prefix || LPAD((v_last_number + 1)::TEXT, 3, '0');
    RETURN v_new_number;
  END IF;
  
  -- ถ้าเป็นสำนักงานใหญ่หรือไม่มี warehouse ใช้รูปแบบ I0+YYMMDD+เลขที่บิล
  -- หาเลขที่บิลล่าสุดในวันเดียวกัน (รวมทุกออเดอร์ที่ไม่ใช่สาขาในวันเดียวกัน)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(
          order_number 
          FROM 'I0' || v_date_prefix || '([0-9]+)$'
        ) AS INTEGER
      )
    ),
    0
  ) INTO v_last_number
  FROM public.orders o
  WHERE o.order_number ~ ('^I0' || v_date_prefix || '[0-9]+$')
    AND o.order_number IS NOT NULL
    AND o.order_date = p_order_date
    AND (
      o.warehouse_id IS NULL 
      OR o.warehouse_id NOT IN (SELECT id FROM public.warehouses WHERE type = 'branch')
      OR NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = o.warehouse_id AND w.type = 'branch')
    );
  
  -- สร้างเลขใหม่: I0+YYMMDD+เลขที่บิล (3 หลัก) สำหรับสำนักงานใหญ่
  v_new_number := 'I0' || v_date_prefix || LPAD((v_last_number + 1)::TEXT, 3, '0');
  
  RETURN v_new_number;
END;
$$ LANGUAGE plpgsql;

-- อัพเดท order_number ให้กับออเดอร์ที่ยังไม่มี
DO $$
DECLARE
  v_order RECORD;
  v_new_number TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  -- Loop ผ่านออเดอร์ที่ไม่มี order_number
  FOR v_order IN 
    SELECT 
      o.id,
      o.order_date,
      o.warehouse_id,
      o.created_at
    FROM public.orders o
    WHERE o.order_number IS NULL OR o.order_number = ''
    ORDER BY o.created_at ASC
  LOOP
    -- สร้าง order_number ใหม่
    v_new_number := generate_backfill_order_number(
      v_order.id,
      v_order.warehouse_id,
      v_order.order_date
    );
    
    -- อัพเดท order_number
    UPDATE public.orders
    SET order_number = v_new_number
    WHERE id = v_order.id;
    
    v_updated_count := v_updated_count + 1;
    
    RAISE NOTICE 'อัพเดท order_number: % -> %', v_order.id, v_new_number;
  END LOOP;
  
  RAISE NOTICE 'อัพเดท order_number เรียบร้อย: % รายการ', v_updated_count;
END $$;

-- ตรวจสอบผลลัพธ์
SELECT 
  COUNT(*) as total_orders,
  COUNT(order_number) as orders_with_number,
  COUNT(*) - COUNT(order_number) as orders_without_number
FROM public.orders;

-- แสดงตัวอย่าง order_number ที่สร้างใหม่
SELECT 
  id,
  order_number,
  order_date,
  warehouse_id,
  (SELECT type FROM public.warehouses WHERE id = orders.warehouse_id) as warehouse_type,
  created_at
FROM public.orders
WHERE order_number IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Cleanup: ลบ function ชั่วคราว (ถ้าต้องการ)
-- DROP FUNCTION IF EXISTS generate_backfill_order_number(UUID, UUID, DATE);
