-- ========================================
-- Export Production Schema
-- ========================================
-- รัน SQL นี้ใน Production project เพื่อ export schema
-- ========================================

-- Export all tables
SELECT 
  'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
  string_agg(
    column_name || ' ' || 
    CASE 
      WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
      WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
      WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
      ELSE UPPER(data_type)
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
    ', '
    ORDER BY ordinal_position
  ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Export all functions
SELECT 
  'CREATE OR REPLACE FUNCTION ' || 
  n.nspname || '.' || p.proname || 
  '(' || pg_get_function_arguments(p.oid) || ')' ||
  ' RETURNS ' || pg_get_function_result(p.oid) ||
  ' LANGUAGE ' || l.lanname ||
  ' AS $$' || p.prosrc || '$$;' as create_function
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- Export all policies
SELECT 
  'CREATE POLICY "' || policyname || '" ON ' || 
  schemaname || '.' || tablename ||
  ' FOR ' || cmd ||
  ' USING (' || qual || ')' ||
  CASE 
    WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')'
    ELSE ''
  END || ';' as create_policy
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Export all triggers
SELECT 
  'CREATE TRIGGER ' || tgname ||
  ' BEFORE ' || CASE WHEN tgtype::int & 2 = 2 THEN 'INSERT' 
                     WHEN tgtype::int & 4 = 4 THEN 'DELETE'
                     WHEN tgtype::int & 8 = 8 THEN 'UPDATE'
                     ELSE 'UNKNOWN' END ||
  ' ON ' || n.nspname || '.' || c.relname ||
  ' FOR EACH ROW' ||
  ' EXECUTE FUNCTION ' || p.proname || '();' as create_trigger
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
