-- Add 'service_staff' role to app_role enum type
-- Enables "พนักงานบริการ" option in profiles.role (e.g. Supabase Table Editor dropdown)

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'service_staff'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    EXECUTE 'ALTER TYPE app_role ADD VALUE ''service_staff''';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'service_staff role already exists in enum';
END $$;

-- Update handle_new_user() to accept service_staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_role text;
BEGIN
  new_role := nullif(new.raw_user_meta_data->>'role', '');

  IF new_role IS NULL THEN
    IF new.email ILIKE '%@driver.local' THEN
      new_role := 'driver';
    ELSIF new.email ILIKE '%@sales.local' THEN
      new_role := 'sales';
    ELSE
      new_role := 'user';
    END IF;
  END IF;

  IF new_role NOT IN ('user', 'inspector', 'manager', 'executive', 'admin', 'driver', 'sales', 'service_staff') THEN
    new_role := 'user';
  END IF;

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
      IF new_role = 'service_staff' THEN
        RAISE WARNING 'service_staff role not in enum yet, using user. Run migration to add service_staff.';
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (
          new.id,
          new.email,
          COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          'user'::app_role
        )
        ON CONFLICT (id) DO NOTHING;
      ELSE
        RAISE;
      END IF;
  END;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Auto-assign role on signup. Supports: user, inspector, manager, executive, admin, driver, sales, service_staff';

COMMIT;
