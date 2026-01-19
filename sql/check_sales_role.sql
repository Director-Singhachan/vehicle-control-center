-- Check if 'sales' role exists in app_role enum
-- Run this to verify if migration has been applied

-- 1. Check if 'sales' exists in enum
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_enum 
      WHERE enumlabel = 'sales' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
    ) THEN '✅ sales role EXISTS in enum'
    ELSE '❌ sales role DOES NOT EXIST in enum - Need to run migration!'
  END as enum_check;

-- 2. List all enum values
SELECT 
  enumlabel as role_value,
  enumsortorder as sort_order
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
ORDER BY enumsortorder;

-- 3. Check handle_new_user() function
SELECT 
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%sales%' THEN '✅ Function includes sales'
    ELSE '❌ Function does NOT include sales - Need to update!'
  END as function_check,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
LIMIT 1;
