-- ========================================
-- อัปเดต check_maintenance_alerts ให้ใช้ center_specified_next_odometer/date
-- ========================================

-- Function: สร้างการแจ้งเตือนอัตโนมัติจาก maintenance_schedules
-- อัปเดตให้ใช้ center_specified_next_odometer/date ถ้ามี
create or replace function public.check_maintenance_alerts()
returns void as $$
declare
  schedule_record record;
  current_odo integer;
  alert_exists boolean;
  next_odo_to_check integer;
  next_date_to_check timestamptz;
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

    -- กำหนด next_odo_to_check: ใช้ center_specified ถ้ามี, ไม่เช่นนั้นใช้ next_service_odometer
    next_odo_to_check := coalesce(
      schedule_record.center_specified_next_odometer,
      schedule_record.next_service_odometer
    );

    -- ตรวจสอบตามไมล์
    if schedule_record.interval_type in ('mileage','both')
       and next_odo_to_check is not null
       and (next_odo_to_check - current_odo) <= schedule_record.alert_before_km then

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
            when (next_odo_to_check - current_odo) <= 0 then 'maintenance_overdue'
            else 'maintenance_due'
          end,
          case 
            when (next_odo_to_check - current_odo) <= 0 then 'critical'
            when (next_odo_to_check - current_odo) <= 100 then 'warning'
            else 'info'
          end,
          'ใกล้ถึงกำหนดบำรุงรักษา',
          format('รถ %s (%s %s) ใกล้ถึงกำหนด %s (เหลือ %s km)%s',
            schedule_record.plate,
            schedule_record.make,
            schedule_record.model,
            schedule_record.maintenance_name,
            next_odo_to_check - current_odo,
            case when schedule_record.center_specified_next_odometer is not null then ' [ตามกำหนดการจากศูนย์]' else '' end
          ),
          schedule_record.id,
          'maintenance_schedule'
        );
      end if;
    end if;

    -- กำหนด next_date_to_check: ใช้ center_specified ถ้ามี, ไม่เช่นนั้นใช้ next_service_date
    next_date_to_check := coalesce(
      schedule_record.center_specified_next_date,
      schedule_record.next_service_date
    );

    -- ตรวจสอบตามเวลา
    if schedule_record.interval_type in ('time','both')
       and next_date_to_check is not null
       and next_date_to_check <= now() + (schedule_record.alert_before_days || ' days')::interval then

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
            when next_date_to_check <= now() then 'maintenance_overdue'
            else 'maintenance_due'
          end,
          case 
            when next_date_to_check <= now() then 'critical'
            when next_date_to_check <= now() + interval '3 days' then 'warning'
            else 'info'
          end,
          'ใกล้ถึงกำหนดบำรุงรักษา',
          format('รถ %s (%s %s) ใกล้ถึงกำหนด %s (เหลือ %s วัน)%s',
            schedule_record.plate,
            schedule_record.make,
            schedule_record.model,
            schedule_record.maintenance_name,
            extract(day from (next_date_to_check - now())),
            case when schedule_record.center_specified_next_date is not null then ' [ตามกำหนดการจากศูนย์]' else '' end
          ),
          schedule_record.id,
          'maintenance_schedule'
        );
      end if;
    end if;
  end loop;
end;
$$ language plpgsql;

