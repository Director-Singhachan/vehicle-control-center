-- Create Test Users for RLS Testing
-- This migration creates test users with different roles for testing permissions
-- ⚠️ IMPORTANT: Only run this in development/staging environments!

-- Function to create test user with profile
create or replace function public.create_test_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role app_role
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  -- Create auth user (this requires Supabase Auth API or manual creation via dashboard)
  -- Note: In Supabase, you need to create users via Auth API or Dashboard
  -- This function assumes the user already exists in auth.users
  
  -- Get user ID from auth.users by email
  select id into v_user_id
  from auth.users
  where email = p_email;
  
  if v_user_id is null then
    raise exception 'User with email % does not exist in auth.users. Please create the user via Supabase Dashboard or Auth API first.', p_email;
  end if;
  
  -- Create or update profile
  insert into public.profiles (id, email, full_name, role)
  values (v_user_id, p_email, p_full_name, p_role)
  on conflict (id) do update
  set email = p_email,
      full_name = p_full_name,
      role = p_role;
  
  return v_user_id;
end;
$$;

-- Helper function to check if test users exist
create or replace function public.test_users_exist()
returns boolean
language sql
stable
as $$
  select count(*) >= 5 from public.profiles
  where email like '%@test.vehicle-control.local';
$$;

-- Note: Actual user creation must be done via Supabase Dashboard or Auth API
-- This script only creates the profiles after users are created

-- Instructions:
-- 1. Create users via Supabase Dashboard → Authentication → Users → Add User
--    Or use Supabase Auth API:
--    POST /auth/v1/admin/users
--    {
--      "email": "admin@test.vehicle-control.local",
--      "password": "Test1234!",
--      "email_confirm": true
--    }
--
-- 2. After creating users, run this SQL to create/update profiles:
--    SELECT public.create_test_user('admin@test.vehicle-control.local', 'Test1234!', 'Admin User', 'admin');
--    SELECT public.create_test_user('manager@test.vehicle-control.local', 'Test1234!', 'Manager User', 'manager');
--    SELECT public.create_test_user('inspector@test.vehicle-control.local', 'Test1234!', 'Inspector User', 'inspector');
--    SELECT public.create_test_user('executive@test.vehicle-control.local', 'Test1234!', 'Executive User', 'executive');
--    SELECT public.create_test_user('user@test.vehicle-control.local', 'Test1234!', 'Regular User', 'user');

-- Test data for vehicles (if needed)
insert into public.vehicles (plate, make, model, type, branch)
values
  ('กก-1234', 'Toyota', 'Hilux', 'Pickup', 'สาขา A'),
  ('ขข-5678', 'Isuzu', 'D-Max', 'Pickup', 'สาขา B'),
  ('คค-9012', 'Mitsubishi', 'Triton', 'Pickup', 'สาขา C')
on conflict (plate) do nothing;

-- Test data for tickets (if needed)
-- Note: This requires existing users and vehicles
-- Uncomment and modify after creating test users:
/*
insert into public.tickets (
  reporter_id,
  vehicle_id,
  odometer,
  urgency,
  repair_type,
  problem_description,
  status
)
select
  (select id from public.profiles where role = 'user' limit 1),
  (select id from public.vehicles limit 1),
  50000,
  'medium',
  'Engine',
  'Test ticket for RLS testing',
  'pending'
where exists (select 1 from public.profiles where role = 'user')
  and exists (select 1 from public.vehicles);
*/

