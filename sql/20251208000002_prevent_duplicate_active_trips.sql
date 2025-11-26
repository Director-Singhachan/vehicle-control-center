-- ========================================
-- Fix: Prevent Duplicate Active Trips (Use SECURITY DEFINER)
-- ========================================
-- ป้องกันการ checkout ซ้ำสำหรับรถคันเดียวกัน
-- ปัญหา: Trigger เดิมอาจไม่ทำงานถ้า RLS filter ข้อมูล
-- วิธีแก้: ใช้ SECURITY DEFINER เพื่อ bypass RLS

-- 1. Drop trigger first (because it depends on the function)
drop trigger if exists check_vehicle_available_trigger on public.trip_logs;

-- 2. Update existing function to use SECURITY DEFINER
-- Use CREATE OR REPLACE instead of DROP to avoid dependency issues
create or replace function public.check_vehicle_available()
returns trigger
language plpgsql
security definer  -- ใช้ SECURITY DEFINER เพื่อ bypass RLS
set search_path = public
as $$
declare
  active_trip_count integer;
begin
  -- Check if vehicle already has an active trip (only when creating new checkout)
  if NEW.status = 'checked_out' then
    -- Count active trips for this vehicle (bypass RLS)
    select count(*) into active_trip_count
    from public.trip_logs
    where vehicle_id = NEW.vehicle_id
      and status = 'checked_out'
      and id != coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    if active_trip_count > 0 then
      raise exception 'รถคันนี้มีการใช้งานอยู่แล้ว กรุณา check-in การใช้งานเดิมก่อน (Vehicle already has an active trip. Please check-in first.)';
    end if;
  end if;
  
  return NEW;
end;
$$;

-- 3. Recreate trigger (with updated function)
create trigger check_vehicle_available_trigger
  before insert or update on public.trip_logs
  for each row
  execute function public.check_vehicle_available();

-- 4. Add comment
comment on function public.check_vehicle_available is 'ป้องกันการ checkout ซ้ำสำหรับรถคันเดียวกัน (ใช้ SECURITY DEFINER เพื่อ bypass RLS)';

-- Note: 
-- - Function ใช้ SECURITY DEFINER เพื่อ bypass RLS และตรวจสอบข้อมูลจริงทั้งหมด
-- - Trigger จะทำงานก่อน insert/update เพื่อป้องกันการสร้าง duplicate
-- - แม้ว่า RLS จะ filter ข้อมูลที่ user เห็น แต่ database constraint จะป้องกันปัญหานี้
-- - กรณีที่คนขับ B เลือกรถที่คนขับ A ใช้งานอยู่ จะไม่สามารถ checkout ได้ (จะได้ error)

