-- Add 'driver' to app_role enum/constraint
-- Note: Supabase doesn't support ALTER TYPE ... ADD VALUE inside a transaction block easily in some versions,
-- but we can check constraint if it's a check constraint, or just add it if it's an enum.
-- Assuming app_role is a check constraint on profiles.role based on previous knowledge, 
-- or if it's a type, we'll try to add it.

DO $$
BEGIN
  -- Check if 'driver' is already in the check constraint or enum
  -- This is a safe way to add it if it's a check constraint
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('user', 'inspector', 'manager', 'executive', 'admin', 'driver'));

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating constraint: %', SQLERRM;
END $$;
