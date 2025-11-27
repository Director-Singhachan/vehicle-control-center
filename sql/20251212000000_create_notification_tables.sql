-- Notification tables for LINE / Telegram integration

-- Settings table: per-user or global notification settings
create table if not exists public.notification_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,

  -- Channels
  enable_line boolean not null default false,
  enable_telegram boolean not null default false,

  -- LINE Notify / Messaging API
  line_token text,

  -- Telegram Bot API
  telegram_bot_token text,
  telegram_chat_id text,

  -- Event toggles
  notify_maintenance_due boolean not null default true,
  notify_long_checkout boolean not null default true,
  notify_ticket_created boolean not null default true,
  notify_ticket_closed boolean not null default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure one settings row per user
create unique index if not exists idx_notification_settings_user
  on public.notification_settings(user_id);

-- Simple event log / queue for notifications
create table if not exists public.notification_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,

  channel text not null check (channel in ('line', 'telegram')),
  event_type text not null check (event_type in (
    'maintenance_due',
    'long_checkout',
    'ticket_created',
    'ticket_closed'
  )),

  title text not null,
  message text not null,
  payload jsonb,

  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,

  created_at timestamptz default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_events_status_created_at
  on public.notification_events(status, created_at);

alter table public.notification_settings enable row level security;
alter table public.notification_events enable row level security;

-- Users can manage their own settings
create policy "Users can view own notification settings"
  on public.notification_settings
  for select
  using (user_id = auth.uid());

create policy "Users can upsert own notification settings"
  on public.notification_settings
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own notification settings"
  on public.notification_settings
  for update
  using (user_id = auth.uid());

-- Only allow inserting notification events for current user
create policy "Users can insert own notification events"
  on public.notification_events
  for insert
  with check (user_id = auth.uid());

-- Users can see their own events (history / debug)
create policy "Users can view own notification events"
  on public.notification_events
  for select
  using (user_id = auth.uid());


