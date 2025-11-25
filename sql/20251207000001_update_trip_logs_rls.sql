-- ========================================
-- Update Trip Logs RLS
-- Add 'inspector' to view all trips policy
-- ========================================

-- Drop existing policy
drop policy if exists "Managers can view all trips" on public.trip_logs;

-- Create new policy including inspector
create policy "Staff can view all trips" 
  on public.trip_logs
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('manager', 'executive', 'admin', 'inspector')
    )
  );

-- Update the update policy as well to be consistent (though inspectors might not need update rights, usually they do for corrections)
-- Let's keep update restricted to manager/executive/admin for now as per original design, 
-- unless user specifically asked for update rights. 
-- The request was "see details", so SELECT is the priority.
-- But if they need to "manage" they might need update. 
-- For now, I will only update the VIEW policy as requested ("เห็นรายละเอียด...ได้ครบถ้วน").
