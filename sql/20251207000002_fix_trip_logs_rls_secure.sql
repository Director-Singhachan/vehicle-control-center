-- ========================================
-- Fix RLS Permissions for Staff (Comprehensive)
-- ========================================

-- 1. Create a secure function to check roles (bypassing RLS recursion)
create or replace function public.has_role(user_id uuid, required_roles text[])
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  user_role text;
begin
  select role into user_role
  from public.profiles
  where id = user_id;
  
  return user_role = any(required_roles);
end;
$$;

-- 2. Update Trip Logs Policy
-- Allow Manager, Executive, Inspector, Admin to view ALL trips
drop policy if exists "Managers can view all trips" on public.trip_logs;
drop policy if exists "Staff can view all trips" on public.trip_logs;

create policy "Staff can view all trips" 
  on public.trip_logs
  for select
  using (
    public.has_role(auth.uid(), ARRAY['manager', 'executive', 'admin', 'inspector'])
    OR
    driver_id = auth.uid() -- Drivers can still see their own
  );

-- 3. Update Profiles Policy
-- Allow Staff to view ALL profiles (to see Driver names, Reporter names, etc.)
-- Currently only Admins and the user themselves can see profiles.
drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "Staff can view all profiles" on public.profiles;

create policy "Staff can view all profiles"
  on public.profiles
  for select
  using (
    id = auth.uid() -- User can see themselves
    OR
    public.has_role(auth.uid(), ARRAY['manager', 'executive', 'admin', 'inspector']) -- Staff can see everyone
  );
