-- Fix RLS policy for executive role to allow updating tickets
-- This is required for the executive to update status from 'approved_manager' to 'ready_for_repair'

drop policy if exists "tickets update executive" on public.tickets;
create policy "tickets update executive" on public.tickets for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('executive','admin')))
  with check (status in ('ready_for_repair', 'rejected'));
