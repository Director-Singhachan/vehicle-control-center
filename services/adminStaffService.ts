// Admin Staff Service — จัดการบัญชีพนักงานผ่าน Edge Function + Supabase
import { supabase } from '../lib/supabase';
import type { Database, AppRole } from '../types/database';

export type StaffProfile = Database['public']['Tables']['profiles']['Row'];

export interface CreateStaffInput {
  full_name: string;
  name_prefix?: string;
  role: AppRole;
  employee_code: string;
  branch?: string;
  department?: string;
  position?: string;
  phone?: string;
  email?: string;
  password: string;
  is_banned?: boolean;
  resignation_date?: string | null;
  /** ผูกบัญชีกับรายชื่อใน service_staff ที่มีอยู่แล้ว (รักษาประวัติทริป) */
  link_service_staff_id?: string;
}

export interface UpdateStaffInput {
  full_name?: string;
  name_prefix?: string | null;
  role?: AppRole;
  branch?: string;
  department?: string;
  position?: string;
  phone?: string;
  email?: string;
  /** ตั้งหรือแก้รหัสพนักงาน (กรณีใช้อีเมลจริงแต่ยังไม่มีรหัส) — ส่งค่าว่างเพื่อล้าง */
  employee_code?: string | null;
  is_banned?: boolean;
  resignation_date?: string | null;
}

export interface StaffListFilters {
  search?: string;
  role?: AppRole | '';
  branch?: string;
  department?: string;
}

async function invokeAdminStaff<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-staff-management', {
    body: { action, ...payload },
  });

  const body = data as { success?: boolean; error?: string } | null;
  // บางกรณี HTTP 4xx แต่ body มี { success: false, error } — อ่านก่อนข้อความ generic
  if (body && body.success === false) {
    throw new Error(body.error || 'Operation failed');
  }

  if (error) {
    const serverMsg = body?.error;
    throw new Error(
      serverMsg || error.message || 'Edge Function error',
    );
  }

  // กันคำตอบว่าง / ไม่มี success: true แล้วฝั่ง client เข้าใจผิดว่าสำเร็จ
  if (body == null || typeof body !== 'object' || body.success !== true) {
    throw new Error(
      'คำตอบจาก admin-staff-management ไม่สมบูรณ์ (คาด JSON มี success: true) — ตรวจการ deploy Edge Function และ URL โปรเจกต์',
    );
  }

  return data as T;
}

export const adminStaffService = {
  // ─── ดึงรหัสพนักงานถัดไป ─────────────────────────────────────────────────
  getNextEmployeeCode: async (): Promise<string> => {
    const result = await invokeAdminStaff<{ employee_code: string }>('next_employee_code');
    return result.employee_code;
  },

  // ─── ดึงรายชื่อพนักงานทั้งหมด ────────────────────────────────────────────
  getAll: async (filters?: StaffListFilters): Promise<StaffProfile[]> => {
    let query = supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('employee_code', { ascending: true, nullsFirst: false });

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }

    if (filters?.branch) {
      query = query.eq('branch', filters.branch);
    }

    if (filters?.department) {
      query = query.ilike('department', `%${filters.department}%`);
    }

    if (filters?.search) {
      const q = filters.search.trim();
      query = query.or(
        `full_name.ilike.%${q}%,email.ilike.%${q}%,employee_code.ilike.%${q}%,phone.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // ─── สร้างบัญชีพนักงานใหม่ ───────────────────────────────────────────────
  createUser: async (
    input: CreateStaffInput,
  ): Promise<{ user_id: string; employee_code: string; email: string }> => {
    return invokeAdminStaff('create_user', input as unknown as Record<string, unknown>);
  },

  // ─── รีเซ็ตรหัสผ่าน ──────────────────────────────────────────────────────
  resetPassword: async (userId: string, newPassword: string): Promise<void> => {
    await invokeAdminStaff('reset_password', { user_id: userId, new_password: newPassword });
  },

  // ─── อัปเดตข้อมูลพนักงาน ─────────────────────────────────────────────────
  updateProfile: async (userId: string, input: UpdateStaffInput): Promise<void> => {
    const emailNorm =
      typeof input.email === 'string' && input.email.trim() ? input.email.trim() : undefined;
    const { email: _omitEmail, ...inputRest } = input;
    await invokeAdminStaff('update_profile', {
      user_id: userId,
      ...inputRest,
      ...(emailNorm !== undefined ? { email: emailNorm } : {}),
    } as Record<string, unknown>);

    // ยืนยันว่า profiles.email เปลี่ยนจริง (กันเคส Edge คืน success แต่ DB ไม่อัปเดต)
    if (emailNorm) {
      const want = emailNorm.toLowerCase();
      const { data: row, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const got = (row?.email ?? '').trim().toLowerCase();
      if (got !== want) {
        throw new Error(
          `อีเมลในฐานข้อมูลยังเป็น "${row?.email ?? '—'}" ไม่ตรง "${emailNorm}" — ตรวจ Edge Function admin-staff-management (update_profile) และ Supabase Auth`,
        );
      }
    }
  },

  // ─── ย้าย email รูปแบบเก่า (@driver.local) → {employee_code}@staff.local ──
  migrateEmail: async (
    userId: string,
    employeeCode: string,
  ): Promise<{ email: string; employee_code: string }> => {
    return invokeAdminStaff('migrate_email', { user_id: userId, employee_code: employeeCode });
  },

  // ─── เปิด/ปิดบัญชี ───────────────────────────────────────────────────────
  toggleStatus: async (userId: string, banned: boolean): Promise<void> => {
    await invokeAdminStaff('toggle_status', { user_id: userId, banned });
  },

  // ─── ลบบัญชีออกจากระบบทั้งหมด (admin only) ──────────────────────────────
  deleteUser: async (userId: string): Promise<void> => {
    await invokeAdminStaff('delete_user', { user_id: userId });
  },

  // ─── ผูก / ย้ายการผูก profile ↔ service_staff ──────────────────────────
  // ใช้เมื่อ service_staff record มี user_id อยู่แล้ว (เช่น account เก่า @driver.local)
  relinkServiceStaff: async (
    userId: string,
    serviceStaffId: string,
  ): Promise<{ previous_user_id: string | null }> => {
    return invokeAdminStaff('relink_service_staff', {
      user_id: userId,
      service_staff_id: serviceStaffId,
    });
  },
};
