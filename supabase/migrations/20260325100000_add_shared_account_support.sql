-- Migration to support shared accounts (multiple staff per email)
-- 1. Add `is_shared_account` to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_shared_account BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_shared_account IS 'If true, this account is shared by multiple staff members, requiring staff selection after login.';

-- 2. Add `active_staff_id` to profiles table
-- This will store the currently selected staff member for a shared account session
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_staff_id UUID REFERENCES public.service_staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_staff_id IS 'For shared accounts, this stores the UUID of the currently active staff member from the service_staff table.';

-- 3. Ensure `service_staff.user_id` can be non-unique
-- First, drop any existing unique constraint on user_id if it exists.
-- The name of the constraint might vary, so we find it dynamically.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.service_staff'::regclass
      AND conname LIKE '%user_id_key%' 
      AND contype = 'u';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.service_staff DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped unique constraint % on service_staff.user_id', constraint_name;
    END IF;
END;
$$;

-- Just ensure the index exists for performance, which is fine for foreign keys.
CREATE INDEX IF NOT EXISTS idx_service_staff_user_id ON public.service_staff(user_id);

-- 4. Create a table to log who performs actions in shared accounts
CREATE TABLE IF NOT EXISTS public.shared_account_activity_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_table TEXT,
    target_record_id UUID,
    details JSONB
);

COMMENT ON TABLE public.shared_account_activity_log IS 'Logs actions performed by individual staff members using a shared account.';
COMMENT ON COLUMN public.shared_account_activity_log.profile_id IS 'The shared profile that was used.';
COMMENT ON COLUMN public.shared_account_activity_log.staff_id IS 'The specific staff member who performed the action.';
COMMENT ON COLUMN public.shared_account_activity_log.action IS 'A description of the action, e.g., ''order_create'', ''trip_update_status''.';

-- Example of setting an account as shared and linking staff
-- Replace with actual UUIDs and employee codes
-- UPDATE public.profiles
-- SET is_shared_account = TRUE
-- WHERE email = 'retail.officerhq@singhachan.co.th';

-- UPDATE public.service_staff
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'retail.officerhq@singhachan.co.th')
-- WHERE employee_code IN ('240014', '260006');

