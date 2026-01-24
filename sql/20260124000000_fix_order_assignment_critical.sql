-- ========================================
-- CRITICAL FIX: Order Assignment to Trip
-- แก้ไขปัญหาการจัดทริปซ้ำและ RLS blocking
-- ========================================
-- 
-- ⚠️ CRITICAL ISSUES:
-- 1. Function generate_order_number_for_trip(uuid, uuid) does not exist
-- 2. Function generate_order_numbers_for_trip(uuid) does not exist  
-- 3. 404 error when PATCH orders (RLS blocking UPDATE)
-- 4. Orders not updated after trip creation (causing duplicate trips)
-- 
-- ✅ FIXES:
-- 1. Create both order number generation functions
-- 2. Fix RLS policies to allow UPDATE
-- 3. Add trigger to auto-generate order numbers
-- ========================================

-- ========================================
-- STEP 1: CREATE ORDER NUMBER FUNCTIONS
-- ========================================

-- Function 1: Generate order number for single order in trip
CREATE OR REPLACE FUNCTION public.generate_order_number_for_trip(
  p_order_id UUID,
  p_trip_id UUID
)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_record RECORD;
  v_trip_record RECORD;
  v_trip_store_record RECORD;
  v_warehouse_type TEXT;
  v_order_date DATE;
  v_year TEXT;
  v_month TEXT;
  v_day TEXT;
  v_date_prefix TEXT;
  v_last_number INTEGER;
  v_new_number TEXT;
  v_lock_key BIGINT;
  v_prefix TEXT;
  v_sequence_order INTEGER;
BEGIN
  -- Get order data
  SELECT o.id, o.store_id, o.order_date, o.warehouse_id, o.order_number
  INTO v_order_record
  FROM public.orders o WHERE o.id = p_order_id;

  IF v_order_record IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Return existing order_number if present
  IF v_order_record.order_number IS NOT NULL AND v_order_record.order_number != '' THEN
    RETURN v_order_record.order_number;
  END IF;

  -- Get trip data
  SELECT dt.id, dt.planned_date
  INTO v_trip_record
  FROM public.delivery_trips dt WHERE dt.id = p_trip_id;

  IF v_trip_record IS NULL THEN
    RAISE EXCEPTION 'Delivery trip not found: %', p_trip_id;
  END IF;

  -- Get sequence_order from delivery_trip_stores
  SELECT dts.sequence_order
  INTO v_trip_store_record
  FROM public.delivery_trip_stores dts
  WHERE dts.delivery_trip_id = p_trip_id AND dts.store_id = v_order_record.store_id
  LIMIT 1;

  IF v_trip_store_record IS NULL THEN
    RAISE EXCEPTION 'Store not found in delivery trip';
  END IF;

  v_sequence_order := v_trip_store_record.sequence_order;
  v_order_date := COALESCE(v_order_record.order_date, v_trip_record.planned_date, CURRENT_DATE);

  -- Get warehouse type
  IF v_order_record.warehouse_id IS NOT NULL THEN
    SELECT type INTO v_warehouse_type
    FROM public.warehouses WHERE id = v_order_record.warehouse_id;
  END IF;

  -- Create date prefix: YYMMDD
  v_year := LPAD((EXTRACT(YEAR FROM v_order_date) % 100)::TEXT, 2, '0');
  v_month := LPAD(EXTRACT(MONTH FROM v_order_date)::TEXT, 2, '0');
  v_day := LPAD(EXTRACT(DAY FROM v_order_date)::TEXT, 2, '0');
  v_date_prefix := v_year || v_month || v_day;

  -- Lock to prevent duplicates
  v_lock_key := EXTRACT(EPOCH FROM v_order_date)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Determine prefix based on warehouse type
  IF v_warehouse_type = 'branch' THEN
    v_prefix := 'SD';
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM v_prefix || v_date_prefix || '([0-9]+)$') AS INTEGER)), 0)
    INTO v_last_number
    FROM public.orders
    WHERE order_number ~ ('^' || v_prefix || v_date_prefix || '[0-9]+$')
      AND warehouse_id = v_order_record.warehouse_id AND order_date = v_order_date;
  ELSE
    v_prefix := 'HQ';
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM v_prefix || v_date_prefix || '([0-9]+)$') AS INTEGER)), 0)
    INTO v_last_number
    FROM public.orders
    WHERE order_number ~ ('^' || v_prefix || v_date_prefix || '[0-9]+$')
      AND (warehouse_id IS NULL OR warehouse_id NOT IN (SELECT id FROM public.warehouses WHERE type = 'branch'))
      AND order_date = v_order_date;
  END IF;

  -- Generate new number
  v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');

  -- Check for duplicates
  WHILE EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_new_number AND id != p_order_id) LOOP
    v_last_number := v_last_number + 1;
    v_new_number := v_prefix || v_date_prefix || LPAD((v_last_number + v_sequence_order)::TEXT, 3, '0');
  END LOOP;

  RETURN v_new_number;
END;
$$;

-- Function 2: Generate order numbers for all orders in trip
CREATE OR REPLACE FUNCTION public.generate_order_numbers_for_trip(
  p_trip_id UUID
)
RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_record RECORD;
  v_new_number TEXT;
BEGIN
  -- Loop through all orders in trip ordered by sequence_order
  FOR v_order_record IN
    SELECT o.id, o.store_id, o.order_number
    FROM public.orders o
    INNER JOIN public.delivery_trip_stores dts ON dts.store_id = o.store_id
    WHERE o.delivery_trip_id = p_trip_id AND dts.delivery_trip_id = p_trip_id
    ORDER BY dts.sequence_order ASC
  LOOP
    -- Generate order_number if missing
    IF v_order_record.order_number IS NULL OR v_order_record.order_number = '' THEN
      v_new_number := generate_order_number_for_trip(v_order_record.id, p_trip_id);
      
      -- Update order_number
      UPDATE public.orders SET order_number = v_new_number WHERE id = v_order_record.id;
      
      -- Return result
      order_id := v_order_record.id;
      order_number := v_new_number;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- ========================================
-- STEP 2: CREATE TRIGGER FOR AUTO ORDER NUMBER
-- ========================================

-- Trigger function
CREATE OR REPLACE FUNCTION public.trigger_generate_order_number_on_trip_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_trip_id UUID;
  v_new_number TEXT;
BEGIN
  -- Check if delivery_trip_id changed from NULL to a value
  IF OLD.delivery_trip_id IS NULL AND NEW.delivery_trip_id IS NOT NULL THEN
    v_order_id := NEW.id;
    v_trip_id := NEW.delivery_trip_id;
    
    -- Generate order_number if missing
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
      v_new_number := generate_order_number_for_trip(v_order_id, v_trip_id);
      NEW.order_number := v_new_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_generate_order_number_on_trip_assignment ON public.orders;

-- Create trigger
CREATE TRIGGER trigger_generate_order_number_on_trip_assignment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.delivery_trip_id IS DISTINCT FROM NEW.delivery_trip_id
    AND NEW.delivery_trip_id IS NOT NULL
    AND (NEW.order_number IS NULL OR NEW.order_number = '')
  )
  EXECUTE FUNCTION trigger_generate_order_number_on_trip_assignment();

-- ========================================
-- STEP 3: FIX ORDERS RLS POLICIES
-- ========================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view orders" ON public.orders;
DROP POLICY IF EXISTS "Owner and admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are viewable by everyone" ON public.orders;

-- Create SELECT policy (required for UPDATE to work)
CREATE POLICY "Staff can view orders"
  ON public.orders FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- Create UPDATE policy
CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'user', 'sales', 'inspector')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'manager', 'user', 'sales', 'inspector')
    )
  );

-- ========================================
-- STEP 4: ADD COMMENTS
-- ========================================

COMMENT ON FUNCTION public.generate_order_number_for_trip(UUID, UUID) IS 
  'Generate order_number for order assigned to trip. Format: SD/HQ + YYMMDD + XXX';

COMMENT ON FUNCTION public.generate_order_numbers_for_trip(UUID) IS 
  'Generate order_numbers for all orders in trip by sequence_order';

COMMENT ON FUNCTION public.trigger_generate_order_number_on_trip_assignment() IS 
  'Trigger to auto-generate order_number when order is assigned to trip';

-- ========================================
-- STEP 5: VERIFICATION
-- ========================================

DO $$
DECLARE
  fn1_exists BOOLEAN;
  fn2_exists BOOLEAN;
  fn3_exists BOOLEAN;
  policy_exists BOOLEAN;
  trigger_exists BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION: Checking fixes...';
  RAISE NOTICE '========================================';
  
  -- Check function 1
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_order_number_for_trip'
      AND pg_get_function_arguments(p.oid) = 'p_order_id uuid, p_trip_id uuid'
  ) INTO fn1_exists;
  
  -- Check function 2
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_order_numbers_for_trip'
      AND pg_get_function_arguments(p.oid) = 'p_trip_id uuid'
  ) INTO fn2_exists;
  
  -- Check function 3
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'trigger_generate_order_number_on_trip_assignment'
  ) INTO fn3_exists;
  
  -- Check policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Staff can update orders'
  ) INTO policy_exists;
  
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'orders' AND t.tgname = 'trigger_generate_order_number_on_trip_assignment'
  ) INTO trigger_exists;
  
  -- Report results
  IF fn1_exists THEN
    RAISE NOTICE '✅ generate_order_number_for_trip function exists';
  ELSE
    RAISE WARNING '⚠️ generate_order_number_for_trip function MISSING';
  END IF;
  
  IF fn2_exists THEN
    RAISE NOTICE '✅ generate_order_numbers_for_trip function exists';
  ELSE
    RAISE WARNING '⚠️ generate_order_numbers_for_trip function MISSING';
  END IF;
  
  IF fn3_exists THEN
    RAISE NOTICE '✅ trigger function exists';
  ELSE
    RAISE WARNING '⚠️ trigger function MISSING';
  END IF;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ trigger exists on orders table';
  ELSE
    RAISE WARNING '⚠️ trigger MISSING on orders table';
  END IF;
  
  IF policy_exists THEN
    RAISE NOTICE '✅ "Staff can update orders" policy exists';
  ELSE
    RAISE WARNING '⚠️ "Staff can update orders" policy MISSING';
  END IF;
  
  RAISE NOTICE '========================================';
  
  IF fn1_exists AND fn2_exists AND fn3_exists AND policy_exists AND trigger_exists THEN
    RAISE NOTICE '✅✅✅ ALL FIXES APPLIED SUCCESSFULLY!';
  ELSE
    RAISE WARNING '⚠️⚠️⚠️ SOME FIXES FAILED - CHECK ABOVE';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
