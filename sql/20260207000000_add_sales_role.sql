-- Add 'sales' role to app_role enum type
-- This migration adds the 'sales' role to support sales team functionality

BEGIN;

-- 1. Add 'sales' to the app_role ENUM type
-- Note: ALTER TYPE ... ADD VALUE cannot be rolled back, but we use IF NOT EXISTS for safety
-- PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE, so we check first
DO $$
BEGIN
  -- Check if 'sales' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'sales' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    -- Add 'sales' to the enum (this cannot be rolled back)
    EXECUTE 'ALTER TYPE app_role ADD VALUE ''sales''';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- If it already exists, that's fine
    RAISE NOTICE 'sales role already exists in enum';
END $$;

-- 2. Update handle_new_user() function to support 'sales' role
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
  IF new_role NOT IN ('user', 'inspector', 'manager', 'executive', 'admin', 'driver', 'sales') THEN
    new_role := 'user';
  END IF;

  -- Try to insert with the role, if it fails (enum doesn't have sales yet), use 'user' as fallback
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
    WHEN invalid_text_representation OR OTHERS THEN
      -- If role doesn't exist in enum (e.g., 'sales' not added yet), use 'user' as fallback
      -- This prevents trigger from failing when migration hasn't been run yet
      IF new_role = 'sales' THEN
        RAISE WARNING 'sales role not found in enum yet, using user instead. Please run migration to add sales role.';
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (
          new.id,
          new.email,
          COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          'user'::app_role
        )
        ON CONFLICT (id) DO NOTHING;
      ELSE
        -- For other errors, re-raise
        RAISE;
      END IF;
  END;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Auto-assign role when new auth users are created. Supports: user, inspector, manager, executive, admin, driver, sales';

COMMIT;
