-- Remove insecure views that bypass RLS
-- Date: 2026-01-27
-- Purpose: Remove views that allow users to see all branches data

-- Drop the views
DROP VIEW IF EXISTS public.delivery_trips_all_branches;
DROP VIEW IF EXISTS public.orders_all_branches;

-- These views are not needed because:
-- 1. They bypass Row Level Security (RLS)
-- 2. Regular queries already support branch filtering
-- 3. Admin users can still query all branches by filtering branch='ALL' in the application

COMMENT ON SCHEMA public IS 'Branch-aware views removed for security. Use direct queries with branch filters instead.';
