-- Check user creation limits and issues
-- Run this to diagnose why user creation might be failing

-- 1. Check total number of users
SELECT 
  'Total Users' as metric,
  COUNT(*) as count
FROM auth.users;

-- 2. Check total number of profiles
SELECT 
  'Total Profiles' as metric,
  COUNT(*) as count
FROM public.profiles;

-- 3. Check users by role
SELECT 
  role,
  COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY user_count DESC;

-- 4. Check if 'sales' role exists in enum
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_enum 
      WHERE enumlabel = 'sales' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
    ) THEN '✅ sales role EXISTS'
    ELSE '❌ sales role DOES NOT EXIST - Need to run migration!'
  END as sales_role_status;

-- 5. Check handle_new_user() function
SELECT 
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%sales%' THEN '✅ Function includes sales'
    ELSE '❌ Function does NOT include sales'
  END as function_status
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
LIMIT 1;

-- 6. Check trigger exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
    ) THEN '✅ Trigger exists'
    ELSE '❌ Trigger does NOT exist'
  END as trigger_status;

-- 7. Check for recent failed user creations (if there's a log table)
-- Note: This might not exist, but checking anyway
SELECT 
  'Recent user creation attempts' as note,
  'Check Supabase Dashboard → Logs → Auth Logs for errors' as instruction;

-- 8. Check Supabase project limits (Free tier info)
SELECT 
  'Supabase Free Tier Limits' as info,
  '50,000 monthly active users' as mau_limit,
  '500MB database size' as db_limit,
  '2GB bandwidth' as bandwidth_limit;
