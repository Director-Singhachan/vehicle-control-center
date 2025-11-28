-- Add PDF support to notification_events table
-- This allows sending PDF files (maintenance tickets) via Telegram/LINE

-- Add pdf_data column to store PDF as base64 string
alter table public.notification_events
  add column if not exists pdf_data text;

-- Add target_user_id column to specify which user should receive the notification
-- (e.g., inspector, manager, executive for approval workflow)
alter table public.notification_events
  add column if not exists target_user_id uuid references auth.users(id);

-- Add index for target_user_id for faster queries
create index if not exists idx_notification_events_target_user
  on public.notification_events(target_user_id);

-- Update event_type CHECK constraint to include new event types
-- First, drop the old constraint
alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

-- Add new constraint with all event types including PDF approval events
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
    'ticket_pdf_for_approval'
  ));

-- Update RLS policy to allow inserting events for target_user_id
-- (This allows the system to send notifications to specific users, not just the event creator)
drop policy if exists "Users can insert own notification events" on public.notification_events;

-- Allow users to insert events for themselves OR for target_user_id (if they have permission)
-- For now, we'll allow inserting if user_id = auth.uid() OR if target_user_id = auth.uid()
-- (The latter allows users to receive notifications sent to them)
create policy "Users can insert notification events"
  on public.notification_events
  for insert
  with check (
    user_id = auth.uid() OR
    target_user_id = auth.uid()
  );

-- Allow users to view events sent to them (via target_user_id)
create policy "Users can view events sent to them"
  on public.notification_events
  for select
  using (
    user_id = auth.uid() OR
    target_user_id = auth.uid()
  );

