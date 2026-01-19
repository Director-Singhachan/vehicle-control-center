-- Fix sales role issue - Comprehensive check and fix
-- Run this to ensure sales role is properly set up

BEGIN;

-- ========================================
-- Step 1: Check if 'sales' exists in enum
-- ========================================
DO $$
DECLARE
  sales_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'sales' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) INTO sales_exists;
  
  IF NOT sales_exists THEN
    RAISE NOTICE 'Adding sales to enum...';
    ALTER TYPE app_role ADD VALUE 'sales';
    RAISE NOTICE '✅ sales role added to enum';
  ELSE
    RAISE NOTICE '✅ sales role already exists in enum';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '✅ sales role already exists (caught exception)';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error adding sales role: %', SQLERRM;
END $$;

-- ========================================
-- Step 2: Update handle_new_user() function
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_role text;
BEGIN
  -- Allow explicit role passed via metadata (e.g., from the admin portal)
  new_role := nullif(new.raw_user_meta_data->>'role', '');

  -- If no explicit role provided, infer from the email domain
  IF new_role IS NULL THEN
    IF new.email ILIKE '%@driver.local' THEN
      new_role := 'driver';
    ELSIF new.email ILIKE '%@sales.local' THEN
      new_role := 'sales';
    ELSE
      new_role := 'user';
    END IF;
  END IF;

  -- Fallback guard: ensure the role value is valid
  -- If sales doesn't exist yet, fallback to user
  IF new_role NOT IN ('user', 'inspector', 'manager', 'executive', 'admin', 'driver', 'sales') THEN
    new_role := 'user';
  END IF;

  -- Try to insert with the role, if it fails (enum doesn't have sales), use 'user'
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      new_role::app_role
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- If role doesn't exist in enum, use 'user' as fallback
      RAISE WARNING 'Role % not found in enum, using user instead', new_role;
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        'user'::app_role
      )
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN new;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ handle_new_user() function updated';
END $$;

-- ========================================
-- Step 3: Ensure trigger exists
-- ========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger on_auth_user_created created';
END $$;

-- ========================================
-- Step 4: Verify setup
-- ========================================
DO $$
DECLARE
  enum_check boolean;
  func_check boolean;
  trigger_check boolean;
BEGIN
  -- Check enum
  SELECT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'sales' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) INTO enum_check;
  
  -- Check function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND pg_get_functiondef(oid) LIKE '%sales%'
  ) INTO func_check;
  
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
    AND tgrelid = 'auth.users'::regclass
  ) INTO trigger_check;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Verification Results:';
  RAISE NOTICE '  Enum has sales: %', CASE WHEN enum_check THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  Function has sales: %', CASE WHEN func_check THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  Trigger exists: %', CASE WHEN trigger_check THEN '✅' ELSE '❌' END;
  RAISE NOTICE '========================================';
  
  IF NOT enum_check THEN
    RAISE EXCEPTION 'sales role not found in enum - please check migration';
  END IF;
END $$;

COMMIT;

-- ========================================
-- Summary
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Setup Complete!';
  RAISE NOTICE 'You can now create users with @sales.local email';
  RAISE NOTICE '========================================';
END $$;
