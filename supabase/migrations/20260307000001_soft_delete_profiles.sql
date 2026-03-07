-- Migration: Soft delete support for profiles
-- เพิ่ม deleted_at เพื่อทำ soft delete บัญชีพนักงาน
-- แก้ FK ticket_approvals.approved_by ให้ SET NULL เมื่อลบ auth user

-- ─── 1. เพิ่ม deleted_at ใน profiles ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Soft delete timestamp — ถ้ามีค่าแสดงว่าบัญชีถูกลบแล้ว (ข้อมูลยังคงอยู่เพื่อ referential integrity)';

-- ─── 2. แก้ FK ticket_approvals.approved_by → ON DELETE SET NULL ───────────
-- คอลัมน์นี้สร้างโดยไม่มี ON DELETE clause (default = RESTRICT) จึงป้องกัน hard delete
ALTER TABLE public.ticket_approvals
  DROP CONSTRAINT IF EXISTS ticket_approvals_approved_by_fkey;

ALTER TABLE public.ticket_approvals
  ADD CONSTRAINT ticket_approvals_approved_by_fkey
  FOREIGN KEY (approved_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;
