
-- Update Order Number Format based on Warehouse (Head Office vs Branch)
-- Migration: 20260204000000_update_order_number_format.sql

-- 1. Add warehouse_id to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);

CREATE INDEX IF NOT EXISTS idx_orders_warehouse_id ON public.orders(warehouse_id);

-- 2. Update generate_order_number function to support I0+YYMMDD+เลขที่บิล format
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
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
  v_lock_key BIGINT;
BEGIN
  -- ใช้ order_date จาก NEW หรือใช้วันที่ปัจจุบัน
  IF NEW.order_date IS NOT NULL THEN
    v_order_date := NEW.order_date;
  ELSE
    v_order_date := CURRENT_DATE;
  END IF;
  
  -- Get warehouse info if available
  IF NEW.warehouse_id IS NOT NULL THEN
    SELECT type, code INTO v_warehouse_type, v_warehouse_code 
    FROM public.warehouses 
    WHERE id = NEW.warehouse_id;
  END IF;
  
  -- สร้าง date prefix: YYMMDD
  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;
  
  -- Lock based on date to prevent duplicates
  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- ถ้าเป็นสาขา: หาเลขที่บิลล่าสุดในวันเดียวกันสำหรับสาขานี้
  IF v_warehouse_type = 'branch' AND NEW.warehouse_id IS NOT NULL THEN
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
      AND warehouse_id = NEW.warehouse_id
      AND order_date = v_order_date;
    
    -- สร้างเลขใหม่: I1+YYMMDD+เลขที่บิล (3 หลัก) สำหรับสาขา
    v_new_number := 'I1' || v_date_prefix || LPAD((v_last_number + 1)::TEXT, 3, '0');
  ELSE
    -- สำนักงานใหญ่หรือไม่มี warehouse: หาเลขที่บิลล่าสุดในวันเดียวกัน (รวมทุกออเดอร์ที่ไม่ใช่สาขา)
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
      AND o.order_date = v_order_date
      AND (
        o.warehouse_id IS NULL 
        OR o.warehouse_id NOT IN (SELECT id FROM public.warehouses WHERE type = 'branch')
        OR NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = o.warehouse_id AND w.type = 'branch')
      );
    
    -- สร้างเลขใหม่: I0+YYMMDD+เลขที่บิล (3 หลัก)
    v_new_number := 'I0' || v_date_prefix || LPAD((v_last_number + 1)::TEXT, 3, '0');
  END IF;
  
  NEW.order_number := v_new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update Trigger (ensure it uses the new function)
DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.orders;

CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

-- 4. Add comment
COMMENT ON FUNCTION generate_order_number IS 'สร้างเลขที่ออเดอร์อัตโนมัติ - สาขา: I1+YYMMDD+เลขที่บิล (3 หลัก) เช่น I1260118001 (นับแยกตาม warehouse ในวันเดียวกัน) - สำนักงานใหญ่: I0+YYMMDD+เลขที่บิล (3 หลัก) เช่น I025012501 (นับรวมทั้งหมดในวันเดียวกัน)';
