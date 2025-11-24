-- Auto-assign the correct role when new auth users are created
-- Drivers (phone-number logins) should automatically get the 'driver' role
-- and admins can optionally pass an explicit role via user metadata.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role text;
begin
  -- Allow explicit role passed via metadata (e.g., from the admin portal)
  new_role := nullif(new.raw_user_meta_data->>'role', '');

  -- If no explicit role provided, infer from the email domain
  if new_role is null then
    if new.email ilike '%@driver.local' then
      new_role := 'driver';
    else
      new_role := 'user';
    end if;
  end if;

  -- Fallback guard: ensure the role value is valid
  if new_role not in ('user', 'inspector', 'manager', 'executive', 'admin', 'driver') then
    new_role := 'user';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new_role::app_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Backfill existing driver accounts that still show as 'user'
update public.profiles
set role = 'driver'
where email ilike '%@driver.local'
  and role <> 'driver';

commit;

