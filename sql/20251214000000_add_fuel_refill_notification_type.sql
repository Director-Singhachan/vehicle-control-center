-- Add fuel_refill to notification_events event_type check constraint

-- Update event_type CHECK constraint to include fuel_refill
-- First, drop the old constraint
alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

-- Add new constraint with all event types including fuel_refill
alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'maintenance_due',
    'long_checkout',
    'ticket_created',
    'ticket_closed',
    'trip_started',
    'trip_finished',
    'daily_usage_summary',
    'ticket_pdf_for_approval',
    'fuel_refill'
  ));
