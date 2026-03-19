-- Migration: Add resignation_date to profiles
-- Date: 2026-03-19

ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS resignation_date DATE;

-- Update comment for the column
COMMENT ON COLUMN public.profiles.resignation_date IS 'วันที่พนักงานลาออก (สำหรับบันทึกประวัติ)';
