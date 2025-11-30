-- Add new notification event type settings
-- เพิ่มการตั้งค่าประเภทการแจ้งเตือนใหม่:
-- - notify_fuel_refill: แจ้งเตือนเมื่อมีการเติมน้ำมัน
-- - notify_trip_started: แจ้งเตือนเมื่อเริ่มใช้งานรถ
-- - notify_trip_finished: แจ้งเตือนเมื่อเสร็จสิ้นการใช้งานรถ
-- - notify_ticket_approval: แจ้งเตือนเมื่อมีการอนุมัติ/ปฏิเสธตั๋ว

alter table public.notification_settings
  add column if not exists notify_fuel_refill boolean not null default true,
  add column if not exists notify_trip_started boolean not null default true,
  add column if not exists notify_trip_finished boolean not null default true,
  add column if not exists notify_ticket_approval boolean not null default true;

-- อัพเดท event_type check constraint ใน notification_events table
alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'maintenance_due',
    'long_checkout',
    'ticket_created',
    'ticket_closed',
    'trip_started',
    'trip_finished',
    'fuel_refill',
    'ticket_pdf_for_approval',
    'daily_usage_summary'
  ));

-- หมายเหตุ:
-- - notify_fuel_refill: สำหรับการแจ้งเตือนเมื่อมีการเติมน้ำมัน (fuel_refill event)
-- - notify_trip_started: สำหรับการแจ้งเตือนเมื่อเริ่มใช้งานรถ (trip_started event)
-- - notify_trip_finished: สำหรับการแจ้งเตือนเมื่อเสร็จสิ้นการใช้งานรถ (trip_finished event)
-- - notify_ticket_approval: สำหรับการแจ้งเตือนเมื่อมีการอนุมัติ/ปฏิเสธตั๋ว (ticket_pdf_for_approval event)
-- - Default value เป็น true เพื่อให้ผู้ใช้ที่ใช้อยู่แล้วยังได้รับแจ้งเตือนเหมือนเดิม
-- - ผู้บริหาร/ผู้ตรวจสอบ/ผู้จัดการสามารถปิดการแจ้งเตือนเติมน้ำมันและการใช้งานรถได้

