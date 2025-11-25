-- ========================================
-- Trip Logs System
-- ระบบบันทึกเลขไมล์ก่อนออกและหลังกลับ
-- ========================================

-- Ensure UUID extension is available
create extension if not exists "uuid-ossp";

-- ========================================
-- Table: trip_logs
-- ========================================
create table if not exists public.trip_logs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  
  -- Check-out data
  odometer_start integer not null,
  checkout_time timestamptz not null default now(),
  
  -- Check-in data
  odometer_end integer,
  checkin_time timestamptz,
  
  -- Calculated fields
  distance_km integer generated always as (
    case 
      when odometer_end is not null and odometer_start is not null 
      then odometer_end - odometer_start 
      else null 
    end
  ) stored,
  
  duration_hours numeric(10,2) generated always as (
    case 
      when checkin_time is not null and checkout_time is not null
      then extract(epoch from (checkin_time - checkout_time)) / 3600
      else null
    end
  ) stored,
  
  -- Optional fields
  destination text,
  route text,
  notes text,
  
  -- Status
  status text not null default 'checked_out' 
    check (status in ('checked_out', 'checked_in')),
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  constraint trip_logs_valid_odometer 
    check (odometer_end is null or odometer_end >= odometer_start),
  constraint trip_logs_valid_time 
    check (checkin_time is null or checkin_time >= checkout_time),
  constraint trip_logs_max_distance 
    check (odometer_end is null or (odometer_end - odometer_start) <= 500)
);

-- ========================================
-- Indexes
-- ========================================
create index if not exists idx_trip_logs_vehicle 
  on public.trip_logs(vehicle_id);

create index if not exists idx_trip_logs_driver 
  on public.trip_logs(driver_id);

create index if not exists idx_trip_logs_status 
  on public.trip_logs(status);

create index if not exists idx_trip_logs_checkout_time 
  on public.trip_logs(checkout_time desc);

create index if not exists idx_trip_logs_vehicle_status 
  on public.trip_logs(vehicle_id, status) 
  where status = 'checked_out';

-- ========================================
-- Trigger: Update updated_at timestamp
-- ========================================
create or replace function public.update_trip_logs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trip_logs_updated_at
  before update on public.trip_logs
  for each row
  execute function public.update_trip_logs_updated_at();

-- ========================================
-- RLS Policies
-- ========================================
alter table public.trip_logs enable row level security;

-- Drivers can view their own trips
create policy "Drivers can view own trips" 
  on public.trip_logs
  for select
  using (driver_id = auth.uid());

-- Drivers can create trips
create policy "Drivers can create trips" 
  on public.trip_logs
  for insert
  with check (driver_id = auth.uid());

-- Drivers can update their own trips
create policy "Drivers can update own trips" 
  on public.trip_logs
  for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- Managers, Executives, and Admins can view all trips
create policy "Managers can view all trips" 
  on public.trip_logs
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('manager', 'executive', 'admin')
    )
  );

-- Managers, Executives, and Admins can update all trips (for corrections)
create policy "Managers can update all trips" 
  on public.trip_logs
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('manager', 'executive', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('manager', 'executive', 'admin')
    )
  );

-- ========================================
-- Function: Prevent duplicate check-out
-- ========================================
create or replace function public.check_vehicle_available()
returns trigger as $$
declare
  active_trip_count integer;
begin
  -- Check if vehicle already has an active trip
  if new.status = 'checked_out' then
    select count(*) into active_trip_count
    from public.trip_logs
    where vehicle_id = new.vehicle_id
      and status = 'checked_out'
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    if active_trip_count > 0 then
      raise exception 'Vehicle already has an active trip. Please check-in first.';
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger check_vehicle_available_trigger
  before insert or update on public.trip_logs
  for each row
  execute function public.check_vehicle_available();

-- ========================================
-- Function: Validate odometer on check-in
-- ========================================
create or replace function public.validate_trip_odometer()
returns trigger as $$
declare
  last_odometer integer;
begin
  -- When checking in, validate odometer_end
  if new.status = 'checked_in' and new.odometer_end is not null then
    -- Get the last odometer reading (from fuel_records or previous trip)
    select coalesce(
      (select odometer from public.fuel_records 
       where vehicle_id = new.vehicle_id 
       order by filled_at desc limit 1),
      (select odometer_end from public.trip_logs 
       where vehicle_id = new.vehicle_id 
       and odometer_end is not null
       order by checkin_time desc limit 1),
      0
    ) into last_odometer;
    
    -- Check if odometer_end is reasonable (not less than last known reading)
    if new.odometer_end < last_odometer then
      raise exception 'Odometer reading (%) is less than last known reading (%). Please verify.', 
        new.odometer_end, last_odometer;
    end if;
    
    -- Check if distance is reasonable (not more than 500 km)
    if (new.odometer_end - new.odometer_start) > 500 then
      raise exception 'Distance (%) exceeds maximum allowed (500 km). Please verify.', 
        (new.odometer_end - new.odometer_start);
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger validate_trip_odometer_trigger
  before insert or update on public.trip_logs
  for each row
  execute function public.validate_trip_odometer();

-- ========================================
-- Comments
-- ========================================
comment on table public.trip_logs is 'บันทึกการเดินทางของรถ (Check-out/Check-in)';
comment on column public.trip_logs.odometer_start is 'เลขไมล์เมื่อ Check-out';
comment on column public.trip_logs.odometer_end is 'เลขไมล์เมื่อ Check-in';
comment on column public.trip_logs.distance_km is 'ระยะทางที่เดินทาง (คำนวณอัตโนมัติ)';
comment on column public.trip_logs.duration_hours is 'เวลาที่ใช้ในการเดินทาง (คำนวณอัตโนมัติ)';
comment on column public.trip_logs.status is 'สถานะ: checked_out (ออกไปแล้ว), checked_in (กลับแล้ว)';

