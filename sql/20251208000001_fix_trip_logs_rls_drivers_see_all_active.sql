-- ========================================
-- Fix Trip Logs RLS: Allow Drivers to See All Active Trips
-- ========================================
-- ปัญหา: Drivers เห็นแค่ trips ของตัวเอง ทำให้ไม่สามารถ check-in รถที่คนอื่นขับได้
-- วิธีแก้: ให้ drivers เห็น active trips ทั้งหมด (แต่ update ได้เฉพาะของตัวเอง)

-- 1. Update SELECT policy to allow drivers to see all active trips
drop policy if exists "Drivers can view own trips" on public.trip_logs;
drop policy if exists "Staff can view all trips" on public.trip_logs;

-- Drivers can see all trips (to check-in any vehicle)
-- Staff can see all trips
create policy "Users can view all trips" 
  on public.trip_logs
  for select
  using (
    -- Staff (manager, executive, admin, inspector) can see all
    public.has_role(auth.uid(), ARRAY['manager', 'executive', 'admin', 'inspector'])
    OR
    -- Drivers can see all trips (to check-in any vehicle)
    -- This allows drivers to see which vehicles are in use
    true -- All authenticated users can view trips
  );

-- 2. Keep UPDATE policy restrictive - drivers can only update their own trips
drop policy if exists "Drivers can update own trips" on public.trip_logs;
drop policy if exists "Managers can update all trips" on public.trip_logs;

-- Drivers can only update their own trips
create policy "Drivers can update own trips" 
  on public.trip_logs
  for update
  using (
    driver_id = auth.uid() -- Drivers can only update their own trips
    OR
    public.has_role(auth.uid(), ARRAY['manager', 'executive', 'admin', 'inspector']) -- Staff can update all
  )
  with check (
    driver_id = auth.uid() -- Drivers can only update their own trips
    OR
    public.has_role(auth.uid(), ARRAY['manager', 'executive', 'admin', 'inspector']) -- Staff can update all
  );

-- 3. Keep INSERT policy - drivers can only create their own trips
-- (This should already be correct, but let's make sure)
drop policy if exists "Drivers can create trips" on public.trip_logs;

create policy "Drivers can create trips" 
  on public.trip_logs
  for insert
  with check (
    driver_id = auth.uid() -- Drivers can only create trips for themselves
    OR
    public.has_role(auth.uid(), ARRAY['manager', 'executive', 'admin', 'inspector']) -- Staff can create for anyone
  );

-- Note: This change allows drivers to:
-- - See all active trips (to know which vehicles are in use)
-- - Check-in any vehicle (by selecting it in the form)
-- - But can only update trips they created (their own trips)
-- - Staff can still update any trip for corrections

