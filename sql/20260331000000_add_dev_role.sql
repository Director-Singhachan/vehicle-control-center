-- Add 'dev' role to app_role enum type and update handle_new_user()
-- Enables "ผู้พัฒนา" option in profiles.role

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'dev'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    EXECUTE 'ALTER TYPE app_role ADD VALUE ''dev''';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'dev role already exists in enum';
END $$;

-- Update handle_new_user() to accept dev
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

  IF new_role NOT IN ('user', 'inspector', 'manager', 'executive', 'admin', 'driver', 'sales', 'service_staff', 'dev') THEN
    new_role := 'user';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
      new_role::public.app_role
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role;
  EXCEPTION
    WHEN invalid_text_representation OR OTHERS THEN
      IF new_role = 'dev' OR new_role = 'service_staff' THEN
        RAISE WARNING '% role not in enum yet, using user. Run migration to add.', new_role;
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (
          new.id,
          new.email,
          COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
          'user'::public.app_role
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
  'Auto-assign role on signup. Supports: user, inspector, manager, executive, admin, driver, sales, service_staff, dev';

COMMIT;
