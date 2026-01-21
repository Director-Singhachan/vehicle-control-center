-- Fix fuel_records update policy to allow admin/manager to update any record
-- Also fixes issue where total_cost (generated column) was being sent in update

-- Drop existing update policy
drop policy if exists "Allow users to update their own fuel records" on public.fuel_records;

-- Create policy for users to update their own records
create policy "Allow users to update their own fuel records"
  on public.fuel_records for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create policy for admin/manager to update any fuel record
create policy "Allow admin and manager to update fuel records"
  on public.fuel_records for update
  to authenticated
  using (public.is_manager_or_admin(auth.uid()))
  with check (public.is_manager_or_admin(auth.uid()));
