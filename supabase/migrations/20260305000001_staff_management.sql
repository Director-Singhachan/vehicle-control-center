-- Migration: Staff Management System
-- เพิ่ม employee_code, department, phone ใน profiles
-- เพิ่ม user_id ใน service_staff (link กับ auth.users)
-- เพิ่ม roles ใหม่: hr, accounting, warehouse

-- ─── 1. profiles: เพิ่ม columns ใหม่ ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_code CHAR(6),
  ADD COLUMN IF NOT EXISTS department    TEXT,
  ADD COLUMN IF NOT EXISTS phone         VARCHAR(20);

-- Unique index: nullable → index เฉพาะ non-null values
CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_code_unique
  ON public.profiles(employee_code)
  WHERE employee_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.employee_code IS 'รหัสพนักงาน 6 หลัก (running number เช่น 000001)';
COMMENT ON COLUMN public.profiles.department IS 'แผนกหรือหน่วยงาน';
COMMENT ON COLUMN public.profiles.phone IS 'เบอร์โทรศัพท์พนักงาน';

-- ─── 2. app_role: เพิ่ม roles ใหม่ ──────────────────────────────────────────
-- รองรับทั้ง PG ENUM และ CHECK constraint
DO $$
BEGIN
  -- กรณีเป็น PostgreSQL ENUM
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounting';
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- กรณีเป็น CHECK constraint บน profiles.role (VARCHAR)
DO $$
DECLARE
  v_constraint_name TEXT;
  v_constraint_def  TEXT;
BEGIN
  SELECT conname, pg_get_constraintdef(oid)
    INTO v_constraint_name, v_constraint_def
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF FOUND AND v_constraint_def NOT ILIKE '%hr%' THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (
        role IN (
          'user','inspector','manager','executive','admin',
          'driver','sales','service_staff',
          'hr','accounting','warehouse'
        )
      );
  END IF;
END $$;

-- ─── 3. service_staff: link ไปยัง auth.users ─────────────────────────────────
ALTER TABLE public.service_staff
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_staff_user_id_idx
  ON public.service_staff(user_id);

COMMENT ON COLUMN public.service_staff.user_id IS 'FK ไปยัง auth.users.id — ใช้เชื่อม service_staff กับบัญชี login';

-- ─── 4. Helper function: generate employee_code ถัดไป ───────────────────────
CREATE OR REPLACE FUNCTION public.get_next_employee_code()
RETURNS CHAR(6)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max  INT;
  v_next CHAR(6);
BEGIN
  SELECT COALESCE(MAX(employee_code::INT), 0) + 1
    INTO v_max
  FROM public.profiles
  WHERE employee_code ~ '^\d{6}$';

  v_next := LPAD(v_max::TEXT, 6, '0');
  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.get_next_employee_code() IS
  'คืน employee_code ถัดไปในรูปแบบ 6-digit zero-padded string';
