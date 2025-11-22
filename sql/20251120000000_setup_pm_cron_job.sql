-- ========================================
-- Setup PM Alert Check Cron Job
-- ตั้งให้ระบบตรวจสอบแจ้งเตือน PM อัตโนมัติทุกวันเวลา 8:00 น.
-- ========================================

-- หมายเหตุ: Supabase ต้องมี extension pg_cron ติดตั้งก่อน
-- ถ้ายังไม่มี ให้รันคำสั่งนี้ใน Supabase SQL Editor:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ตั้ง cron job ให้เรียก check_maintenance_alerts() ทุกวันเวลา 8:00 น.
-- รูปแบบ: 'minute hour day month weekday'
-- '0 8 * * *' = ทุกวันเวลา 8:00 น. (UTC)
-- '0 15 * * *' = ทุกวันเวลา 15:00 น. (UTC) = 22:00 น. เวลาไทย (UTC+7)

-- ลบ cron job เก่า (ถ้ามี)
SELECT cron.unschedule('check-maintenance-alerts-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-maintenance-alerts-daily'
);

-- สร้าง cron job ใหม่
-- หมายเหตุ: ถ้า Supabase project ของคุณไม่มี pg_cron extension
-- ให้ใช้วิธีอื่น เช่น:
-- 1. สร้าง Supabase Edge Function ที่เรียก function นี้
-- 2. ใช้ external cron service (เช่น cron-job.org) ที่เรียก API endpoint
-- 3. เรียกจาก frontend เมื่อโหลดหน้า PM/Dashboard (ทำแล้วใน PmView.vue)

-- สำหรับ Supabase ที่มี pg_cron:
-- SELECT cron.schedule(
--   'check-maintenance-alerts-daily',
--   '0 8 * * *', -- ทุกวันเวลา 8:00 น. UTC (15:00 น. เวลาไทย)
--   $$SELECT public.check_maintenance_alerts()$$
-- );

-- ========================================
-- วิธีตั้ง cron job แบบอื่น (ถ้าไม่มี pg_cron):
-- ========================================

-- 1. สร้าง Supabase Edge Function:
--    - สร้าง function ที่เรียก check_maintenance_alerts()
--    - ตั้ง cron job ภายนอก (เช่น Vercel Cron, GitHub Actions) ให้เรียก Edge Function

-- 2. ใช้ external service:
--    - ไปที่ cron-job.org หรือ similar service
--    - สร้าง HTTP request ไปที่ Supabase Edge Function URL
--    - ตั้งเวลาให้เรียกทุกวันเวลา 8:00 น. (เวลาไทย)

-- 3. เรียกจาก frontend (ทำแล้ว):
--    - เมื่อโหลดหน้า PM → เรียก apiCheckMaintenanceAlerts()
--    - เมื่อโหลดหน้า Dashboard → เรียก apiCheckMaintenanceAlerts()
--    - ข้อดี: ทำงานทันทีเมื่อ user เข้าหน้า
--    - ข้อเสีย: ต้องมีคนเข้าเว็บถึงจะตรวจสอบ

