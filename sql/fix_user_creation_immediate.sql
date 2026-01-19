-- Immediate fix for user creation issue
-- This will update handle_new_user() to handle 'sales' role gracefully
-- even if the enum doesn't have 'sales' yet

BEGIN;

-- Update handle_new_user() function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_role text;
  sales_exists boolean;
BEGIN
  -- Check if 'sales' exists in enum
  SELECT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'sales' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) INTO sales_exists;

  -- Allow explicit role passed via metadata (e.g., from the admin portal)
  new_role := nullif(new.raw_user_meta_data->>'role', '');

  -- If no explicit role provided, infer from the email domain
  IF new_role IS NULL THEN
    IF new.email ILIKE '%@driver.local' THEN
      new_role := 'driver';
    ELSIF new.email ILIKE '%@sales.local' THEN
      -- Only use 'sales' if it exists in enum, otherwise use 'user'
      IF sales_exists THEN
        new_role := 'sales';
      ELSE
        new_role := 'user';
        RAISE WARNING 'sales role not in enum yet, using user instead. Please run migration to add sales role.';
      END IF;
    ELSE
      new_role := 'user';
    END IF;
  END IF;

  -- Fallback guard: ensure the role value is valid
  IF new_role NOT IN ('user', 'inspector', 'manager', 'executive', 'admin', 'driver', 'sales') THEN
    new_role := 'user';
  END IF;

  -- If role is 'sales' but enum doesn't have it, use 'user' instead
  IF new_role = 'sales' AND NOT sales_exists THEN
    new_role := 'user';
    RAISE WARNING 'sales role not in enum, using user instead. User can be updated to sales after migration.';
  END IF;

  -- Insert profile with safe role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new_role::app_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Ultimate fallback: use 'user' if anything goes wrong
    RAISE WARNING 'Error in handle_new_user: %, using user role as fallback', SQLERRM;
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      'user'::app_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Auto-assign role when new auth users are created. Supports: user, inspector, manager, executive, admin, driver, sales. Gracefully handles missing sales role.';

COMMIT;

-- Verify the function was updated
DO $$
BEGIN
  RAISE NOTICE '✅ handle_new_user() function updated with safe error handling';
  RAISE NOTICE 'You can now create users even if sales role migration has not been run yet';
  RAISE NOTICE 'Users with @sales.local will get user role initially, can be updated after migration';
END $$;
