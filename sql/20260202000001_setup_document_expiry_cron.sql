-- ========================================
-- Setup Cron Job for Document Expiry Alerts
-- ========================================
-- This script sets up automatic checking of document expiry
-- Run this AFTER running the main migration
-- ========================================

-- ========================================
-- 1. Enable pg_cron extension (if not already enabled)
-- ========================================

-- Note: This requires superuser privileges
-- If you don't have superuser access, ask your database admin to run:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- For Supabase, pg_cron is usually already enabled
-- But we'll check first
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension is not enabled. Please enable it first.';
    RAISE NOTICE 'You may need superuser privileges or contact Supabase support.';
  END IF;
END $$;

-- ========================================
-- 2. Remove existing cron job if exists
-- ========================================

-- Unschedule existing job if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job 
    WHERE jobname = 'check-vehicle-document-expiry'
  ) THEN
    PERFORM cron.unschedule('check-vehicle-document-expiry');
    RAISE NOTICE 'Removed existing cron job: check-vehicle-document-expiry';
  END IF;
END $$;

-- ========================================
-- 3. Create new cron job
-- ========================================

-- Schedule: Every day at 09:00 UTC (16:00 Thailand time)
-- This will check all documents and create alerts for expiring documents
SELECT cron.schedule(
  'check-vehicle-document-expiry',           -- Job name
  '0 9 * * *',                               -- Cron: Every day at 09:00 UTC (16:00 Thailand)
  $$SELECT check_vehicle_document_expiry()$$ -- SQL to execute
);

-- Alternative schedules (uncomment one if you prefer):

-- Every 6 hours:
-- SELECT cron.schedule(
--   'check-vehicle-document-expiry',
--   '0 */6 * * *',
--   $$SELECT check_vehicle_document_expiry()$$
-- );

-- Every day at 08:00 UTC (15:00 Thailand):
-- SELECT cron.schedule(
--   'check-vehicle-document-expiry',
--   '0 8 * * *',
--   $$SELECT check_vehicle_document_expiry()$$
-- );

-- ========================================
-- 4. Verify cron job was created
-- ========================================

-- Check if job exists
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'check-vehicle-document-expiry';

-- ========================================
-- 5. Test the function manually (optional)
-- ========================================

-- Uncomment to test immediately:
-- SELECT check_vehicle_document_expiry();

-- ========================================
-- 6. View cron job execution history
-- ========================================

-- This query shows the last 10 executions
-- Run this later to check if the job is running:
/*
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-vehicle-document-expiry')
ORDER BY start_time DESC
LIMIT 10;
*/

-- ========================================
-- Notes:
-- ========================================
-- 1. Cron jobs run in UTC time
--    - 09:00 UTC = 16:00 Thailand time (UTC+7)
--    - Adjust the schedule if needed
--
-- 2. To change the schedule later:
--    SELECT cron.unschedule('check-vehicle-document-expiry');
--    SELECT cron.schedule('check-vehicle-document-expiry', 'NEW_SCHEDULE', $$SELECT check_vehicle_document_expiry()$$);
--
-- 3. To disable the job temporarily:
--    UPDATE cron.job SET active = false WHERE jobname = 'check-vehicle-document-expiry';
--
-- 4. To re-enable:
--    UPDATE cron.job SET active = true WHERE jobname = 'check-vehicle-document-expiry';
--
-- 5. To remove the job completely:
--    SELECT cron.unschedule('check-vehicle-document-expiry');
