-- Allow managers/executives/admins to delete trip_logs
-- ใช้สำหรับรองรับฟังก์ชันลบทริป (deleteTrip) ใน tripLogService

alter table public.trip_logs enable row level security;

-- Postgres ยังไม่รองรับ IF NOT EXISTS ใน create policy
-- เลยใช้ drop policy if exists นำหน้าก่อน
drop policy if exists "Managers can delete trips" on public.trip_logs;

create policy "Managers can delete trips"
  on public.trip_logs
  for delete
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('manager', 'executive', 'admin')
    )
  );

