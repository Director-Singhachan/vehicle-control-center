-- ========================================
-- Vehicle Management Core Tables
-- - vehicle_usage
-- - fuel_records
-- - maintenance_schedules
-- - maintenance_history
-- - vehicle_alerts
-- Views & helper functions for dashboard/analytics
-- ========================================

-- Ensure UUID extension is available (for uuid_generate_v4)
create extension if not exists "uuid-ossp";

-- ========================================
-- 1. vehicle_usage - บันทึกการใช้งานรถ
-- ========================================

create table if not exists public.vehicle_usage (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id),

  -- ข้อมูลไมล์
  odometer_start integer not null,
  odometer_end integer,
  distance_km integer generated always as (odometer_end - odometer_start) stored,

  -- ข้อมูลเวลา
  start_time timestamptz not null default now(),
  end_time timestamptz,
  duration_hours numeric(10,2) generated always as (
    extract(epoch from (end_time - start_time)) / 3600
  ) stored,

  -- ข้อมูลการใช้งาน
  purpose text not null, -- 'delivery', 'pickup', 'meeting', 'maintenance', 'other'
  destination text,
  route text,
  notes text,

  -- สถานะ
  status text default 'in_progress', -- 'in_progress', 'completed', 'cancelled'

  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Constraints
  constraint vehicle_usage_valid_odometer check (odometer_end is null or odometer_end >= odometer_start),
  constraint vehicle_usage_valid_time check (end_time is null or end_time >= start_time)
);

create index if not exists idx_vehicle_usage_vehicle on public.vehicle_usage(vehicle_id);
create index if not exists idx_vehicle_usage_user on public.vehicle_usage(user_id);
create index if not exists idx_vehicle_usage_start_time on public.vehicle_usage(start_time);
create index if not exists idx_vehicle_usage_status on public.vehicle_usage(status);

alter table public.vehicle_usage enable row level security;

drop policy if exists "Allow authenticated users to view vehicle usage" on public.vehicle_usage;
create policy "Allow authenticated users to view vehicle usage"
  on public.vehicle_usage for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated users to insert vehicle usage" on public.vehicle_usage;
create policy "Allow authenticated users to insert vehicle usage"
  on public.vehicle_usage for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to update their own vehicle usage" on public.vehicle_usage;
create policy "Allow users to update their own vehicle usage"
  on public.vehicle_usage for update
  to authenticated
  using (auth.uid() = user_id);

-- ========================================
-- 2. fuel_records - บันทึกการเติมน้ำมัน
-- ========================================

create table if not exists public.fuel_records (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id),

  -- ข้อมูลไมล์
  odometer integer not null,

  -- ข้อมูลน้ำมัน
  fuel_type text not null, -- 'gasoline_91', 'gasoline_95', 'gasoline_e20', 'diesel', 'electric'
  liters numeric(10,2) not null,
  price_per_liter numeric(10,2) not null,
  total_cost numeric(10,2) generated always as (liters * price_per_liter) stored,

  -- ข้อมูลปั๊ม
  fuel_station text,
  fuel_station_location text,
  receipt_number text,
  receipt_image_url text,

  -- การคำนวณ
  distance_since_last_fill integer, -- คำนวณจาก fuel_records ก่อนหน้า
  fuel_efficiency numeric(10,2), -- km/L หรือ km/kWh

  -- หมายเหตุ
  notes text,
  is_full_tank boolean default true,

  -- Metadata
  filled_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Constraints
  constraint fuel_records_valid_liters check (liters > 0),
  constraint fuel_records_valid_price check (price_per_liter > 0),
  constraint fuel_records_valid_odometer check (odometer > 0)
);

create index if not exists idx_fuel_records_vehicle on public.fuel_records(vehicle_id);
create index if not exists idx_fuel_records_filled_at on public.fuel_records(filled_at);
create index if not exists idx_fuel_records_user on public.fuel_records(user_id);

alter table public.fuel_records enable row level security;

drop policy if exists "Allow authenticated users to view fuel records" on public.fuel_records;
create policy "Allow authenticated users to view fuel records"
  on public.fuel_records for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated users to insert fuel records" on public.fuel_records;
create policy "Allow authenticated users to insert fuel records"
  on public.fuel_records for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to update their own fuel records" on public.fuel_records;
create policy "Allow users to update their own fuel records"
  on public.fuel_records for update
  to authenticated
  using (auth.uid() = user_id);

-- ========================================
-- 3. maintenance_schedules - ตารางบำรุงรักษา
-- ========================================

create table if not exists public.maintenance_schedules (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,

  -- ประเภทการบำรุงรักษา
  maintenance_type text not null, -- 'oil_change', 'tire_rotation', 'brake_inspection', 'battery_check', 'air_filter', 'annual_inspection'
  maintenance_name text not null,
  description text,

  -- ช่วงเวลาการบำรุงรักษา
  interval_type text not null, -- 'mileage', 'time', 'both'
  interval_km integer, -- ทุกกี่กิโลเมตร (เช่น 5000, 10000)
  interval_months integer, -- ทุกกี่เดือน (เช่น 3, 6, 12)

  -- การบำรุงรักษาครั้งล่าสุด
  last_service_date timestamptz,
  last_service_odometer integer,

  -- การบำรุงรักษาครั้งถัดไป
  next_service_date timestamptz,
  next_service_odometer integer,

  -- การแจ้งเตือน
  alert_before_km integer default 500, -- แจ้งเตือนก่อนถึงกำหนด (km)
  alert_before_days integer default 7, -- แจ้งเตือนก่อนถึงกำหนด (วัน)

  -- สถานะ
  is_active boolean default true,
  priority text default 'normal', -- 'low', 'normal', 'high', 'critical'

  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references public.profiles(id),

  -- Constraints
  constraint maintenance_schedules_valid_interval check (
    (interval_type = 'mileage' and interval_km > 0) or
    (interval_type = 'time' and interval_months > 0) or
    (interval_type = 'both' and interval_km > 0 and interval_months > 0)
  )
);

create index if not exists idx_maintenance_schedules_vehicle on public.maintenance_schedules(vehicle_id);
create index if not exists idx_maintenance_schedules_next_service on public.maintenance_schedules(next_service_date, next_service_odometer);
create index if not exists idx_maintenance_schedules_active on public.maintenance_schedules(is_active);

alter table public.maintenance_schedules enable row level security;

drop policy if exists "Allow authenticated users to view maintenance schedules" on public.maintenance_schedules;
create policy "Allow authenticated users to view maintenance schedules"
  on public.maintenance_schedules for select
  to authenticated
  using (true);

drop policy if exists "Allow admins to manage maintenance schedules" on public.maintenance_schedules;
create policy "Allow admins to manage maintenance schedules"
  on public.maintenance_schedules for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role in ('admin','manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.role in ('admin','manager')
    )
  );

-- ========================================
-- 4. maintenance_history - ประวัติการบำรุงรักษา
-- ========================================

create table if not exists public.maintenance_history (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  schedule_id uuid references public.maintenance_schedules(id) on delete set null,
  ticket_id bigint references public.tickets(id) on delete set null, -- เชื่อมกับระบบแจ้งซ่อม

  -- ข้อมูลการบำรุงรักษา
  maintenance_type text not null,
  maintenance_name text not null,
  description text,

  -- ข้อมูลไมล์และเวลา
  odometer integer not null,
  performed_at timestamptz not null default now(),

  -- ข้อมูลค่าใช้จ่าย
  cost numeric(10,2),
  labor_cost numeric(10,2),
  parts_cost numeric(10,2),

  -- ข้อมูลผู้ดำเนินการ
  performed_by text, -- ชื่อช่าง/ผู้ดำเนินการ
  garage text, -- ชื่ออู่ซ่อม/สถานที่ซ่อม (ใช้ text แทน garage_id เพื่อความยืดหยุ่น)

  -- รายละเอียด
  parts_replaced text[], -- อาร์เรย์ของชิ้นส่วนที่เปลี่ยน
  notes text,
  recommendations text, -- คำแนะนำจากช่าง

  -- เอกสาร
  invoice_url text,
  images_urls text[],

  -- Metadata
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists idx_maintenance_history_vehicle on public.maintenance_history(vehicle_id);
create index if not exists idx_maintenance_history_schedule on public.maintenance_history(schedule_id);
create index if not exists idx_maintenance_history_ticket on public.maintenance_history(ticket_id);
create index if not exists idx_maintenance_history_performed_at on public.maintenance_history(performed_at desc);

alter table public.maintenance_history enable row level security;

drop policy if exists "Allow authenticated users to view maintenance history" on public.maintenance_history;
create policy "Allow authenticated users to view maintenance history"
  on public.maintenance_history for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated users to insert maintenance history" on public.maintenance_history;
create policy "Allow authenticated users to insert maintenance history"
  on public.maintenance_history for insert
  to authenticated
  with check (created_by = auth.uid());

-- ========================================
-- 5. vehicle_alerts - การแจ้งเตือนรถ
-- ========================================

create table if not exists public.vehicle_alerts (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,

  -- ประเภทการแจ้งเตือน
  alert_type text not null, -- 'maintenance_due', 'maintenance_overdue', 'high_fuel_consumption', 'low_usage', 'document_expiry'
  severity text not null default 'info', -- 'info', 'warning', 'critical'

  -- ข้อความ
  title text not null,
  message text not null,

  -- ข้อมูลอ้างอิง
  reference_id uuid, -- อ้างอิงถึง schedule_id หรือ document_id
  reference_type text, -- 'maintenance_schedule', 'document', 'fuel_record'

  -- สถานะ
  is_read boolean default false,
  is_resolved boolean default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),

  -- Metadata
  created_at timestamptz default now(),

  -- Constraints
  constraint vehicle_alerts_valid_severity check (severity in ('info','warning','critical'))
);

create index if not exists idx_vehicle_alerts_vehicle on public.vehicle_alerts(vehicle_id);
create index if not exists idx_vehicle_alerts_unread on public.vehicle_alerts(is_read) where is_read = false;
create index if not exists idx_vehicle_alerts_unresolved on public.vehicle_alerts(is_resolved) where is_resolved = false;
create index if not exists idx_vehicle_alerts_created_at on public.vehicle_alerts(created_at desc);

alter table public.vehicle_alerts enable row level security;

drop policy if exists "Allow authenticated users to view alerts" on public.vehicle_alerts;
create policy "Allow authenticated users to view alerts"
  on public.vehicle_alerts for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated users to update alerts" on public.vehicle_alerts;
create policy "Allow authenticated users to update alerts"
  on public.vehicle_alerts for update
  to authenticated
  using (true);

-- ========================================
-- 6. Views สำหรับ Dashboard / Analytics
-- ========================================

-- View: สรุปข้อมูลรถแต่ละคัน
create or replace view public.vehicle_dashboard as
select 
  v.id,
  v.plate,
  v.make,
  v.model,
  v.type,
  v.branch,

  -- ไมล์ล่าสุด
  coalesce(
    -- 1) ใช้เลขไมล์จากการเติมน้ำมันล่าสุดก่อน (เชื่อถือได้สุด)
    (
      select fr.odometer
      from public.fuel_records fr
      where fr.vehicle_id = v.id
      order by fr.filled_at desc
      limit 1
    ),
    -- 2) ถ้าไม่มี ให้ใช้เลขไมล์จากการใช้งานรถล่าสุด
    (
      select coalesce(vu.odometer_end, vu.odometer_start)
      from public.vehicle_usage vu
      where vu.vehicle_id = v.id
      order by coalesce(vu.end_time, vu.start_time) desc
      limit 1
    ),
    -- 3) ถ้ายังไม่มีเลย แสดงเป็น 0
    0
  ) as current_odometer,

  -- การใช้งาน
  (select vu.status from public.vehicle_usage vu where vu.vehicle_id = v.id and vu.status = 'in_progress' limit 1) as usage_status,
  (select count(*) from public.vehicle_usage vu where vu.vehicle_id = v.id and vu.start_time > now() - interval '30 days') as trips_last_30_days,

  -- น้ำมัน
  (select fr.filled_at from public.fuel_records fr where fr.vehicle_id = v.id order by fr.filled_at desc limit 1) as last_fuel_date,
  (select avg(fr.fuel_efficiency) from public.fuel_records fr where fr.vehicle_id = v.id and fr.filled_at > now() - interval '30 days' and fr.fuel_efficiency is not null) as avg_fuel_efficiency,
  (select sum(fr.total_cost) from public.fuel_records fr where fr.vehicle_id = v.id and fr.filled_at > now() - interval '30 days') as fuel_cost_last_30_days,

  -- การบำรุงรักษา
  (select mh.performed_at from public.maintenance_history mh where mh.vehicle_id = v.id order by mh.performed_at desc limit 1) as last_maintenance_date,
  (select count(*) from public.maintenance_schedules ms where ms.vehicle_id = v.id and ms.is_active = true) as active_schedules,
  (select count(*) from public.maintenance_schedules ms
     where ms.vehicle_id = v.id
       and ms.is_active = true
       and (
         (ms.next_service_odometer is not null and ms.next_service_odometer - coalesce(
            (select fr.odometer from public.fuel_records fr where fr.vehicle_id = v.id order by fr.filled_at desc limit 1), 0
          ) < ms.alert_before_km)
         or
         (ms.next_service_date is not null and ms.next_service_date < now() + (ms.alert_before_days || ' days')::interval)
       )
  ) as upcoming_maintenance_count,

  -- การแจ้งเตือน
  (select count(*) from public.vehicle_alerts va where va.vehicle_id = v.id and va.is_resolved = false) as unresolved_alerts_count,
  (select count(*) from public.vehicle_alerts va where va.vehicle_id = v.id and va.is_resolved = false and va.severity = 'critical') as critical_alerts_count,

  -- ค่าใช้จ่ายรวมจาก ticket_costs ใน 30 วันที่ผ่านมา
  (select sum(tc.cost)
     from public.ticket_costs tc
     join public.tickets t on t.id = tc.ticket_id
    where t.vehicle_id = v.id
      and t.created_at > now() - interval '30 days'
  ) as maintenance_cost_last_30_days

from public.vehicles v;

-- View: สรุปอัตราสิ้นเปลือง
create or replace view public.fuel_efficiency_summary as
select 
  fr.vehicle_id,
  v.plate,
  v.make,
  v.model,
  date_trunc('month', fr.filled_at) as month,
  count(*) as fill_count,
  sum(fr.liters) as total_liters,
  sum(fr.total_cost) as total_cost,
  avg(fr.fuel_efficiency) as avg_efficiency,
  min(fr.fuel_efficiency) as min_efficiency,
  max(fr.fuel_efficiency) as max_efficiency
from public.fuel_records fr
join public.vehicles v on v.id = fr.vehicle_id
where fr.fuel_efficiency is not null
group by fr.vehicle_id, v.plate, v.make, v.model, date_trunc('month', fr.filled_at);

-- View: สรุปการใช้งานรถ
create or replace view public.vehicle_usage_summary as
select 
  vu.vehicle_id,
  v.plate,
  v.make,
  v.model,
  date_trunc('month', vu.start_time) as month,
  count(*) as trip_count,
  sum(vu.distance_km) as total_distance,
  avg(vu.distance_km) as avg_distance,
  sum(vu.duration_hours) as total_hours,
  avg(vu.duration_hours) as avg_hours
from public.vehicle_usage vu
join public.vehicles v on v.id = vu.vehicle_id
where vu.status = 'completed'
group by vu.vehicle_id, v.plate, v.make, v.model, date_trunc('month', vu.start_time);

-- ========================================
-- 7. Functions และ Triggers สำหรับการคำนวณอัตโนมัติ
-- ========================================

-- Function: คำนวณ fuel efficiency อัตโนมัติ
create or replace function public.calculate_fuel_efficiency()
returns trigger as $$
declare
  prev_record record;
begin
  -- หา fuel record ก่อนหน้า
  select *
    into prev_record
    from public.fuel_records
   where vehicle_id = new.vehicle_id
     and filled_at < new.filled_at
     and is_full_tank = true
   order by filled_at desc
   limit 1;

  -- ถ้ามี record ก่อนหน้า ให้คำนวณ
  if prev_record is not null then
    new.distance_since_last_fill := new.odometer - prev_record.odometer;
    if new.liters > 0 and new.distance_since_last_fill > 0 then
      new.fuel_efficiency := new.distance_since_last_fill::numeric / new.liters;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_calculate_fuel_efficiency on public.fuel_records;
create trigger trigger_calculate_fuel_efficiency
  before insert or update on public.fuel_records
  for each row
  execute function public.calculate_fuel_efficiency();

-- Function: อัปเดตตารางบำรุงรักษาอัตโนมัติเมื่อมี maintenance_history ใหม่
create or replace function public.update_maintenance_schedule()
returns trigger as $$
begin
  -- อัปเดต schedule ที่เกี่ยวข้อง
  update public.maintenance_schedules
     set last_service_date = new.performed_at,
         last_service_odometer = new.odometer,
         next_service_date = case 
           when interval_type in ('time','both') then new.performed_at + (interval_months || ' months')::interval
           else next_service_date
         end,
         next_service_odometer = case
           when interval_type in ('mileage','both') then new.odometer + interval_km
           else next_service_odometer
         end,
         updated_at = now()
   where id = new.schedule_id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_maintenance_schedule on public.maintenance_history;
create trigger trigger_update_maintenance_schedule
  after insert on public.maintenance_history
  for each row
  when (new.schedule_id is not null)
  execute function public.update_maintenance_schedule();

-- Function: สร้างการแจ้งเตือนอัตโนมัติจาก maintenance_schedules
create or replace function public.check_maintenance_alerts()
returns void as $$
declare
  schedule_record record;
  current_odo integer;
  alert_exists boolean;
begin
  for schedule_record in 
    select ms.*, v.plate, v.make, v.model
      from public.maintenance_schedules ms
      join public.vehicles v on v.id = ms.vehicle_id
     where ms.is_active = true
  loop
    -- ดึงไมล์ปัจจุบัน
    select coalesce(
             (select fr.odometer from public.fuel_records fr where fr.vehicle_id = schedule_record.vehicle_id order by fr.filled_at desc limit 1),
             0
           )
      into current_odo;

    -- ตรวจสอบตามไมล์
    if schedule_record.interval_type in ('mileage','both')
       and schedule_record.next_service_odometer is not null
       and (schedule_record.next_service_odometer - current_odo) <= schedule_record.alert_before_km then

      -- ตรวจสอบว่ามี alert อยู่แล้วหรือไม่
      select exists(
               select 1 from public.vehicle_alerts
                where vehicle_id = schedule_record.vehicle_id
                  and reference_id = schedule_record.id
                  and is_resolved = false
             )
        into alert_exists;

      if not alert_exists then
        insert into public.vehicle_alerts (
          vehicle_id, alert_type, severity, title, message, reference_id, reference_type
        ) values (
          schedule_record.vehicle_id,
          case 
            when (schedule_record.next_service_odometer - current_odo) <= 0 then 'maintenance_overdue'
            else 'maintenance_due'
          end,
          case 
            when (schedule_record.next_service_odometer - current_odo) <= 0 then 'critical'
            when (schedule_record.next_service_odometer - current_odo) <= 100 then 'warning'
            else 'info'
          end,
          'ใกล้ถึงกำหนดบำรุงรักษา',
          format('รถ %s (%s %s) ใกล้ถึงกำหนด %s (เหลือ %s km)',
            schedule_record.plate,
            schedule_record.make,
            schedule_record.model,
            schedule_record.maintenance_name,
            schedule_record.next_service_odometer - current_odo
          ),
          schedule_record.id,
          'maintenance_schedule'
        );
      end if;
    end if;

    -- ตรวจสอบตามเวลา
    if schedule_record.interval_type in ('time','both')
       and schedule_record.next_service_date is not null
       and schedule_record.next_service_date <= now() + (schedule_record.alert_before_days || ' days')::interval then

      select exists(
               select 1 from public.vehicle_alerts
                where vehicle_id = schedule_record.vehicle_id
                  and reference_id = schedule_record.id
                  and is_resolved = false
             )
        into alert_exists;

      if not alert_exists then
        insert into public.vehicle_alerts (
          vehicle_id, alert_type, severity, title, message, reference_id, reference_type
        ) values (
          schedule_record.vehicle_id,
          case 
            when schedule_record.next_service_date <= now() then 'maintenance_overdue'
            else 'maintenance_due'
          end,
          case 
            when schedule_record.next_service_date <= now() then 'critical'
            when schedule_record.next_service_date <= now() + interval '3 days' then 'warning'
            else 'info'
          end,
          'ใกล้ถึงกำหนดบำรุงรักษา',
          format('รถ %s (%s %s) ใกล้ถึงกำหนด %s (เหลือ %s วัน)',
            schedule_record.plate,
            schedule_record.make,
            schedule_record.model,
            schedule_record.maintenance_name,
            extract(day from (schedule_record.next_service_date - now()))
          ),
          schedule_record.id,
          'maintenance_schedule'
        );
      end if;
    end if;
  end loop;
end;
$$ language plpgsql;

-- หมายเหตุ: การตั้ง cron job ให้เรียกใช้ฟังก์ชันนี้สามารถทำผ่าน pg_cron หรือ Edge Function ภายนอกได้ เช่น:
-- SELECT cron.schedule('check-maintenance-alerts', '0 8 * * *', 'SELECT public.check_maintenance_alerts()');


