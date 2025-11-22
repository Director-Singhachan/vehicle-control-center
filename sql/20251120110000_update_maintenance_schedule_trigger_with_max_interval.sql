-- ========================================
-- อัปเดต trigger function ให้คำนึงถึง max_interval
-- ========================================

-- Function: อัปเดตตารางบำรุงรักษาอัตโนมัติเมื่อมี maintenance_history ใหม่
-- คำนวณ next_service โดยคำนึงถึง max_interval (ถ้ามี)
create or replace function public.update_maintenance_schedule()
returns trigger as $$
declare
  schedule_record record;
  calculated_next_odo integer;
  calculated_next_date timestamptz;
  max_next_odo integer;
  max_next_date timestamptz;
begin
  -- ดึงข้อมูล schedule ที่เกี่ยวข้อง
  select * into schedule_record
  from public.maintenance_schedules
  where id = new.schedule_id;

  if schedule_record is null then
    return new;
  end if;

  -- คำนวณ next_service_odometer
  -- ถ้ามี center_specified_next_odometer ให้ใช้ค่านั้นแทน
  if schedule_record.center_specified_next_odometer is not null then
    calculated_next_odo := schedule_record.center_specified_next_odometer;
  elsif schedule_record.interval_type in ('mileage','both')
     and schedule_record.interval_km is not null
     and new.odometer is not null then
    calculated_next_odo := new.odometer + schedule_record.interval_km;
  else
    calculated_next_odo := schedule_record.next_service_odometer;
  end if;

  -- คำนวณ next_service_date
  -- ถ้ามี center_specified_next_date ให้ใช้ค่านั้นแทน
  if schedule_record.center_specified_next_date is not null then
    calculated_next_date := schedule_record.center_specified_next_date;
  elsif schedule_record.interval_type in ('time','both')
     and schedule_record.interval_months is not null
     and new.performed_at is not null then
    calculated_next_date := new.performed_at + (schedule_record.interval_months || ' months')::interval;
  else
    calculated_next_date := schedule_record.next_service_date;
  end if;

  -- อัปเดต schedule
  update public.maintenance_schedules
     set last_service_date = new.performed_at,
         last_service_odometer = new.odometer,
         next_service_date = calculated_next_date,
         next_service_odometer = calculated_next_odo,
         updated_at = now()
   where id = new.schedule_id;

  return new;
end;
$$ language plpgsql;

