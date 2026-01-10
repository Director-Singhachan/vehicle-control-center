-- ========================================
-- Fix All Remaining Function Search Path warnings
-- แก้ไข Function Search Path Mutable warnings ที่เหลือทั้งหมด
-- ========================================
-- 
-- Issue: Functions without SET search_path are vulnerable to search_path injection
-- Solution: Add SET search_path = '' to all remaining functions
-- ========================================

-- ========================================
-- 1. Fix functions using ALTER FUNCTION (for functions that already exist)
-- ========================================

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_inventory_last_updated_at',
        'get_staff_item_statistics',
        'get_staff_item_details',
        'update_tier_pricing_updated_at',
        'get_product_price_for_store',
        'generate_order_number',
        'set_order_number',
        'update_orders_updated_at',
        'log_order_status_change',
        'calculate_order_total',
        'recalculate_order_total',
        'generate_delivery_trip_number',
        'delete_order_items'
      )
  LOOP
    RAISE NOTICE 'Setting search_path to empty for %', fn.regproc;
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = '''';',
        fn.regproc
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to set search_path for %: %', fn.regproc, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ========================================
-- 2. Explicitly fix functions with CREATE OR REPLACE
-- (for functions that need specific fixes)
-- ========================================

-- Drop functions that might have overloads before recreating them
-- Note: We use DO block to drop all overloads safely
DO $$
DECLARE
  fn RECORD;
BEGIN
  -- Drop all overloads of generate_order_number
  FOR fn IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_order_number'
  LOOP
    RAISE NOTICE 'Dropping function %', fn.regproc;
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.regproc);
  END LOOP;
  
  -- Drop all overloads of other functions that might have issues
  FOR fn IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_order_number',
        'log_order_status_change',
        'generate_delivery_trip_number',
        'get_staff_item_statistics',
        'get_staff_item_details',
        'get_product_price_for_store',
        'calculate_order_total',
        'recalculate_order_total',
        'delete_order_items',
        'delete_orders'
      )
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.regproc);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not drop %: %', fn.regproc, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 2.1 update_inventory_last_updated_at
CREATE OR REPLACE FUNCTION update_inventory_last_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2.2 update_tier_pricing_updated_at
CREATE OR REPLACE FUNCTION update_tier_pricing_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2.3 generate_order_number (TRIGGER version - from 20260120000000_create_orders_system.sql)
-- This is the version used by triggers - newer version with advisory lock
-- Note: There was also a RETURNS TEXT version used by set_order_number(),
-- but since set_order_number() is not actively used (we use trigger_generate_order_number instead),
-- we only create the TRIGGER version here.
-- If you need the TEXT version, it would conflict, so we skip it.
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  current_year INTEGER;
  current_month INTEGER;
  lock_key BIGINT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  current_month := EXTRACT(MONTH FROM NOW())::INTEGER;
  
  -- Generate format: ORD-YYMM-XXXX (e.g., ORD-2501-0001)
  year_month_prefix := 'ORD-' || 
    LPAD((current_year % 100)::TEXT, 2, '0') || 
    LPAD(current_month::TEXT, 2, '0') || 
    '-';
  
  lock_key := (current_year * 100 + current_month)::BIGINT;
  
  PERFORM pg_advisory_xact_lock(lock_key);
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.orders
  WHERE order_number LIKE year_month_prefix || '%'
    AND order_number ~ (year_month_prefix || '[0-9]+$');
  
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  NEW.order_number := new_number;
  RETURN NEW;
END;
$$;

-- 2.4 log_order_status_change (from 20260120000000_create_orders_system.sql)
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, status, changed_by, notes)
    VALUES (NEW.id, NEW.status, auth.uid(), 
      'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2.5 generate_delivery_trip_number
CREATE OR REPLACE FUNCTION generate_delivery_trip_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  year_month_prefix TEXT;
  last_number INTEGER;
  new_number TEXT;
  current_year INTEGER;
  current_month INTEGER;
  lock_key BIGINT;
BEGIN
  -- Get current year and month
  current_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  current_month := EXTRACT(MONTH FROM NOW())::INTEGER;
  
  -- Generate format: DT-YYMM-XXXX (e.g., DT-2512-0001)
  year_month_prefix := 'DT-' || 
    LPAD((current_year % 100)::TEXT, 2, '0') || 
    LPAD(current_month::TEXT, 2, '0') || 
    '-';
  
  -- Create a lock key based on year and month to prevent race conditions
  -- Using year*100 + month as lock key (e.g., 202512 for Dec 2025)
  lock_key := (current_year * 100 + current_month)::BIGINT;
  
  -- Acquire advisory lock (will be released at end of transaction)
  PERFORM pg_advisory_xact_lock(lock_key);
  
  -- Get last trip number for this year-month
  SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '[0-9]+$') AS INTEGER)), 0)
  INTO last_number
  FROM public.delivery_trips
  WHERE trip_number LIKE year_month_prefix || '%'
    AND trip_number ~ (year_month_prefix || '[0-9]+$'); -- Ensure it matches the pattern
  
  -- Generate new number
  new_number := year_month_prefix || LPAD((last_number + 1)::TEXT, 4, '0');
  
  NEW.trip_number := new_number;
  RETURN NEW;
END;
$$;

-- 2.6 get_staff_item_statistics
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
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

-- 2.7 get_staff_item_details
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
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

-- 2.8 get_product_price_for_store
CREATE OR REPLACE FUNCTION get_product_price_for_store(
  p_product_id UUID,
  p_store_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_tier_id UUID;
  v_price DECIMAL(10, 2);
  v_base_price DECIMAL(10, 2);
BEGIN
  -- ดึง tier_id ของร้าน
  SELECT tier_id INTO v_tier_id
  FROM public.stores
  WHERE id = p_store_id;
  
  -- ถ้ามี tier กำหนดไว้ ให้หาราคาตาม tier
  IF v_tier_id IS NOT NULL THEN
    SELECT price INTO v_price
    FROM public.product_tier_prices
    WHERE product_id = p_product_id
      AND tier_id = v_tier_id
      AND min_quantity <= p_quantity
      AND is_active = true
      AND (effective_from IS NULL OR effective_from <= p_date)
      AND (effective_to IS NULL OR effective_to >= p_date)
    ORDER BY min_quantity DESC
    LIMIT 1;
  END IF;
  
  -- ถ้าไม่มีราคา tier ให้ใช้ base_price
  IF v_price IS NULL THEN
    SELECT base_price INTO v_price
    FROM public.products
    WHERE id = p_product_id;
  END IF;
  
  RETURN COALESCE(v_price, 0);
END;
$$;

-- 2.3b Helper function for TEXT version (used by set_order_number)
-- Internal helper function that returns TEXT
CREATE OR REPLACE FUNCTION _generate_order_number_text()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_number TEXT;
  max_number INT;
  current_year_month TEXT;
BEGIN
  -- รูปแบบ: ORD-YYMM-XXXX (เช่น ORD-2501-0001)
  current_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  
  -- หาเลขล่าสุดในเดือนนี้
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(
          order_number, 
          'ORD-' || current_year_month || '-', 
          ''
        ), 
        ''
      )::INT
    ), 
    0
  ) INTO max_number
  FROM public.orders
  WHERE order_number LIKE 'ORD-' || current_year_month || '-%';
  
  -- สร้างเลขใหม่
  new_number := 'ORD-' || current_year_month || '-' || LPAD((max_number + 1)::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$;

-- 2.9 set_order_number
-- Note: This function calls _generate_order_number_text() instead of generate_order_number()
-- to avoid conflict between TRIGGER and TEXT return types
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := _generate_order_number_text();
  END IF;
  RETURN NEW;
END;
$$;

-- 2.10 update_orders_updated_at
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2.11 calculate_order_total
CREATE OR REPLACE FUNCTION calculate_order_total(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_subtotal DECIMAL(10, 2);
BEGIN
  -- คำนวณ subtotal จาก order_items
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_subtotal
  FROM public.order_items
  WHERE order_id = p_order_id;
  
  -- อัปเดตยอดรวมในออเดอร์
  UPDATE public.orders
  SET 
    subtotal = v_subtotal,
    total_amount = v_subtotal - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0)
  WHERE id = p_order_id;
END;
$$;

-- 2.12 recalculate_order_total
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- ถ้าเป็น INSERT หรือ UPDATE ใช้ order_id ใหม่
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_order_total(NEW.order_id);
  END IF;
  
  -- ถ้าเป็น DELETE ใช้ order_id เก่า
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_order_total(OLD.order_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2.13 delete_orders
CREATE OR REPLACE FUNCTION public.delete_orders(
  p_order_number TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_order_numbers TEXT[] DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  deleted_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_message TEXT;
BEGIN
  -- ลบตาม order_number เดียว
  IF p_order_number IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE order_number = p_order_number;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ %s สำเร็จ', p_order_number);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบตาม order_id
  ELSIF p_order_id IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE id = p_order_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ (ID: %s) สำเร็จ', p_order_id);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบหลายออเดอร์ตาม order_numbers
  ELSIF p_order_numbers IS NOT NULL AND array_length(p_order_numbers, 1) > 0 THEN
    DELETE FROM public.orders
    WHERE order_number = ANY(p_order_numbers);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์จำนวน %s รายการสำเร็จ', v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบตาม status
  ELSIF p_status IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE status = p_status;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ที่มีสถานะ %s จำนวน %s รายการสำเร็จ', p_status, v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  -- ลบตามช่วงวันที่
  ELSIF p_date_from IS NOT NULL AND p_date_to IS NOT NULL THEN
    DELETE FROM public.orders
    WHERE order_date BETWEEN p_date_from AND p_date_to;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบออเดอร์ระหว่าง %s ถึง %s จำนวน %s รายการสำเร็จ', p_date_from, p_date_to, v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_message;
    
  ELSE
    RETURN QUERY SELECT 0, 'กรุณาระบุเงื่อนไขในการลบออเดอร์'::TEXT;
  END IF;
END;
$$;

-- 2.14 delete_order_items
CREATE OR REPLACE FUNCTION public.delete_order_items(
  p_order_id UUID DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_item_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  deleted_count INTEGER,
  order_number TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_record RECORD;
  v_deleted_count INTEGER := 0;
  v_message TEXT;
  v_target_order_id UUID;
BEGIN
  -- ถ้ามี p_order_number ระบุ ให้ใช้ order_number (วิธีที่ง่ายกว่า)
  IF p_order_number IS NOT NULL THEN
    -- หา order_id จาก order_number
    SELECT o.id, o.order_number, o.status
    INTO v_order_record
    FROM public.orders o
    WHERE o.order_number = p_order_number;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT 0, p_order_number, format('ไม่พบออเดอร์ %s', p_order_number)::TEXT;
      RETURN;
    END IF;
    
    v_target_order_id := v_order_record.id;
    
  -- ถ้ามี p_order_id ระบุ ให้ใช้ order_id โดยตรง
  ELSIF p_order_id IS NOT NULL THEN
    -- ตรวจสอบว่าออเดอร์มีอยู่จริง
    SELECT o.id, o.order_number, o.status
    INTO v_order_record
    FROM public.orders o
    WHERE o.id = p_order_id;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT 0, NULL::TEXT, 'ไม่พบออเดอร์ที่ระบุ'::TEXT;
      RETURN;
    END IF;
    
    v_target_order_id := p_order_id;
  END IF;
  
  -- ถ้ามี target order ให้ลบรายการทั้งหมด
  IF v_target_order_id IS NOT NULL THEN
    -- ลบรายการทั้งหมดจากออเดอร์
    DELETE FROM public.order_items
    WHERE order_id = v_target_order_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบรายการออเดอร์ %s จำนวน %s รายการสำเร็จ', v_order_record.order_number, v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, v_order_record.order_number, v_message;
    
  -- ถ้ามี p_item_ids ระบุ ให้ลบรายการตาม ids ที่ระบุ
  ELSIF p_item_ids IS NOT NULL AND array_length(p_item_ids, 1) > 0 THEN
    -- ลบรายการตาม ids
    DELETE FROM public.order_items
    WHERE id = ANY(p_item_ids);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_message := format('ลบรายการออเดอร์จำนวน %s รายการสำเร็จ', v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count, NULL::TEXT, v_message;
  ELSE
    RETURN QUERY SELECT 0, NULL::TEXT, 'กรุณาระบุ order_id, order_number หรือ item_ids'::TEXT;
  END IF;
END;
$$;
