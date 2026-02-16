-- Fix: handle_new_user() fails with "type app_role does not exist"
-- Cause: SET search_path = '' so unqualified type app_role is not found.
-- Fix: Use schema-qualified type public.app_role in the function body.

BEGIN;

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
    ELSIF new.email ILIKE '%@service.local' THEN
      new_role := 'service_staff';
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
      new_role::public.app_role
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
  'Auto-assign role on signup. Supports: user, inspector, manager, executive, admin, driver, sales, service_staff. Uses public.app_role for search_path safety.';

COMMIT;
