-- ========================================
-- Fix Profiles RLS Infinite Recursion
-- แก้ไขปัญหา infinite recursion ใน profiles RLS policy
-- ========================================

-- ปัญหา: Policy "profiles self read" มีการ query profiles table ภายใน policy เอง
-- ทำให้เกิด infinite recursion เมื่อตรวจสอบ policy

-- วิธีแก้ไข: ใช้ function ที่เป็น SECURITY DEFINER เพื่อ bypass RLS
-- หรือทำให้ policy ง่ายขึ้น

-- ========================================
-- Option 1: สร้าง helper function (แนะนำ)
-- ========================================

-- Function เพื่อตรวจสอบ role โดยไม่เกิด recursion
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
  );
$$;

-- Function เพื่อตรวจสอบ role (manager หรือ admin)
create or replace function public.is_manager_or_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role in ('manager', 'admin')
  );
$$;

-- ========================================
-- Option 2: แก้ไข policies ให้ใช้ function
-- ========================================

-- ลบ policies เก่า
drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles admin manage" on public.profiles;

-- สร้าง policy ใหม่ที่ใช้ function (ไม่เกิด recursion)
create policy "profiles self read" on public.profiles
  for select
  using (
    id = auth.uid() 
    or public.is_admin(auth.uid())
  );

create policy "profiles admin manage" on public.profiles
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ========================================
-- Option 3: แก้ไข policies อื่นๆ ที่ใช้ profiles
-- ========================================

-- Vehicles policies
drop policy if exists "vehicles write manager" on public.vehicles;
create policy "vehicles write manager" on public.vehicles
  for all
  using (public.is_manager_or_admin(auth.uid()))
  with check (public.is_manager_or_admin(auth.uid()));

-- Tickets policies
drop policy if exists "tickets update inspector" on public.tickets;
create policy "tickets update inspector" on public.tickets
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('inspector', 'manager', 'admin')
    )
  )
  with check (status in ('approved_inspector','rejected','pending','ready_for_repair','in_progress','completed'));

drop policy if exists "tickets update manager" on public.tickets;
create policy "tickets update manager" on public.tickets
  for update
  using (public.is_manager_or_admin(auth.uid()))
  with check (true);

-- Ticket costs policies
drop policy if exists "costs manage manager" on public.ticket_costs;
create policy "costs manage manager" on public.ticket_costs
  for all
  using (public.is_manager_or_admin(auth.uid()))
  with check (public.is_manager_or_admin(auth.uid()));

-- Maintenance schedules policies (ถ้ามี)
drop policy if exists "Allow admins to manage maintenance schedules" on public.maintenance_schedules;
create policy "Allow admins to manage maintenance schedules"
  on public.maintenance_schedules
  for all
  to authenticated
  using (public.is_manager_or_admin(auth.uid()))
  with check (public.is_manager_or_admin(auth.uid()));

-- Audit logs policies
drop policy if exists "audit_logs admin read" on public.audit_logs;
create policy "audit_logs admin read"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- หมายเหตุ:
-- - Functions ใช้ SECURITY DEFINER เพื่อ bypass RLS
-- - ทำให้สามารถ query profiles ได้โดยไม่เกิด recursion
-- - ใช้ SET search_path เพื่อความปลอดภัย

