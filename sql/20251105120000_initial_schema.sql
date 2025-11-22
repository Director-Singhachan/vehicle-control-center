-- Initial schema for Vehicle Maintenance v3 (Supabase Edition)
-- Profiles table maps to auth.users and stores app-specific fields

create extension if not exists "uuid-ossp";

-- Roles enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('user', 'inspector', 'manager', 'executive', 'admin');
  end if;
end $$;

-- Urgency enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'urgency_level') then
    create type urgency_level as enum ('low', 'medium', 'high', 'critical');
  end if;
end $$;

-- Ticket status enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type ticket_status as enum (
      'pending',
      'approved_inspector',
      'approved_manager',
      'ready_for_repair',
      'in_progress',
      'completed',
      'rejected'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  plate text unique not null,
  make text,
  model text,
  type text,
  branch text,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  odometer integer,
  urgency urgency_level not null default 'low',
  repair_type text,
  problem_description text,
  status ticket_status not null default 'pending',
  image_urls jsonb default '[]'::jsonb
);

create table if not exists public.ticket_approvals (
  id uuid primary key default uuid_generate_v4(),
  ticket_id bigint not null references public.tickets(id) on delete cascade,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  role_at_approval text,
  action text check (action in ('approved','rejected')) not null,
  comments text,
  signature_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_costs (
  id uuid primary key default uuid_generate_v4(),
  ticket_id bigint not null references public.tickets(id) on delete cascade,
  description text,
  cost numeric,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_approvals enable row level security;
alter table public.ticket_costs enable row level security;

-- Helper: get current user id
create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select auth.uid();
$$;

-- Profiles RLS
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "profiles admin manage" on public.profiles;
create policy "profiles admin manage" on public.profiles
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (true);

-- Vehicles RLS: readable by authenticated users; writable by admin/manager
drop policy if exists "vehicles read all" on public.vehicles;
create policy "vehicles read all" on public.vehicles for select using (auth.uid() is not null);

drop policy if exists "vehicles write manager" on public.vehicles;
create policy "vehicles write manager" on public.vehicles for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));

-- Tickets RLS
-- Read: authenticated users can read tickets related to their branch or created by them. Simplify: all authenticated can read for now.
drop policy if exists "tickets read" on public.tickets;
create policy "tickets read" on public.tickets for select using (auth.uid() is not null);

-- Insert: any authenticated user can create with reporter_id = self
drop policy if exists "tickets insert self" on public.tickets;
create policy "tickets insert self" on public.tickets for insert
  with check (reporter_id = auth.uid());

-- Update status transitions via roles
drop policy if exists "tickets update inspector" on public.tickets;
create policy "tickets update inspector" on public.tickets for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('inspector','manager','admin')))
  with check (status in ('approved_inspector','rejected','pending','ready_for_repair','in_progress','completed'));

drop policy if exists "tickets update manager" on public.tickets;
create policy "tickets update manager" on public.tickets for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin')))
  with check (true);

-- Approvals RLS
drop policy if exists "approvals read" on public.ticket_approvals;
create policy "approvals read" on public.ticket_approvals for select using (auth.uid() is not null);

drop policy if exists "approvals insert approver" on public.ticket_approvals;
create policy "approvals insert approver" on public.ticket_approvals for insert
  with check (approver_id = auth.uid());

-- Costs RLS
drop policy if exists "costs read" on public.ticket_costs;
create policy "costs read" on public.ticket_costs for select using (auth.uid() is not null);

drop policy if exists "costs manage manager" on public.ticket_costs;
create policy "costs manage manager" on public.ticket_costs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin')));

-- Storage buckets (to be created via dashboard or SQL if using storage API is available in SQL)
-- Note: Configure bucket policies separately via Supabase Storage policies

-- Seed hook: create a profile for the current user if not exists
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


