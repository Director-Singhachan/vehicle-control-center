-- Add line_user_id to notification_settings for LINE Messaging API mapping

alter table public.notification_settings
  add column if not exists line_user_id text;


