// Supabase Edge Function: admin-staff-management
// จัดการบัญชีพนักงานโดย Admin/HR โดยไม่ต้องเข้า Supabase Dashboard
//
// Actions:
//   create_user       — สร้างบัญชี auth user + profiles + service_staff (driver/service_staff)
//   reset_password    — รีเซ็ตรหัสผ่านด้วย user_id
//   update_profile    — แก้ไข full_name, role, department, phone
//   toggle_status     — เปิด/ปิดบัญชี (ban duration)
//   next_employee_code — ดึงรหัสพนักงานถัดไป
//
// Security: เรียกได้เฉพาะผู้ที่มี role = 'admin' หรือ 'hr'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STAFF_EMAIL_DOMAIN = '@staff.local';

// Roles ที่ต้อง auto-create service_staff record
const OPERATIONAL_ROLES = new Set(['driver', 'service_staff']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // ─── Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonError('Unauthorized', 401);
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) return jsonError('Unauthorized', 401);

    // ─── Verify caller role is admin or hr ─────────────────────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileErr || !callerProfile) return jsonError('Forbidden', 403);
    if (callerProfile.role !== 'admin' && callerProfile.role !== 'hr') {
      return jsonError('Forbidden: ต้องเป็น Admin หรือ HR เท่านั้น', 403);
    }

    const body = await req.json();
    const { action } = body;

    // ─── next_employee_code ─────────────────────────────────────────────────
    if (action === 'next_employee_code') {
      const { data, error } = await adminClient.rpc('get_next_employee_code');
      if (error) throw error;
      return jsonOk({ employee_code: data });
    }

    // ─── create_user ────────────────────────────────────────────────────────
    if (action === 'create_user') {
      const { full_name, role, branch, department, phone, password, employee_code: rawCode } = body;

      if (!full_name || !role || !password) {
        return jsonError('full_name, role และ password จำเป็นต้องระบุ', 400);
      }

      const employee_code = typeof rawCode === 'string' ? rawCode.trim() : '';
      if (!employee_code) {
        return jsonError('รหัสพนักงานจำเป็นต้องระบุ', 400);
      }

      // ตรวจรหัสไม่ซ้ำ
      const { data: existing } = await adminClient
        .from('profiles')
        .select('id')
        .eq('employee_code', employee_code)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return jsonError('รหัสพนักงานนี้มีในระบบแล้ว', 400);
      }

      const email = `${employee_code}${STAFF_EMAIL_DOMAIN}`;

      // Create auth user
      const { data: newAuthUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;
      const userId = newAuthUser.user!.id;

      // Upsert profile (trigger อาจสร้าง row ไว้แล้ว → update แทน insert ซ้ำ)
      const { error: profileInsertErr } = await adminClient.from('profiles').upsert({
        id: userId,
        email,
        full_name,
        role,
        branch: branch || null,
        department: department || null,
        phone: phone || null,
        employee_code,
      }, { onConflict: 'id' });
      if (profileInsertErr) {
        // Rollback: delete auth user
        await adminClient.auth.admin.deleteUser(userId);
        throw profileInsertErr;
      }

      // Auto-create service_staff record for operational roles
      if (OPERATIONAL_ROLES.has(role)) {
        const { error: ssErr } = await adminClient.from('service_staff').insert({
          name: full_name,
          phone: phone || null,
          employee_code,
          user_id: userId,
          status: 'active',
        });
        if (ssErr) console.warn('[admin-staff] Failed to create service_staff record:', ssErr.message);
      }

      return jsonOk({ user_id: userId, employee_code, email });
    }

    // ─── reset_password ─────────────────────────────────────────────────────
    if (action === 'reset_password') {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) return jsonError('user_id และ new_password จำเป็นต้องระบุ', 400);
      if (new_password.length < 6) return jsonError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 400);

      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      });
      if (error) throw error;
      return jsonOk({ message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
    }

    // ─── update_profile ─────────────────────────────────────────────────────
    if (action === 'update_profile') {
      const { user_id, full_name, role, branch, department, phone } = body;
      if (!user_id) return jsonError('user_id จำเป็นต้องระบุ', 400);

      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined) updates.role = role;
      if (branch !== undefined) updates.branch = branch;
      if (department !== undefined) updates.department = department;
      if (phone !== undefined) updates.phone = phone;

      const { error } = await adminClient.from('profiles').update(updates).eq('id', user_id);
      if (error) throw error;

      // Sync name to service_staff if linked
      if (full_name !== undefined) {
        await adminClient
          .from('service_staff')
          .update({ name: full_name, phone: phone || null })
          .eq('user_id', user_id);
      }

      return jsonOk({ message: 'อัปเดตข้อมูลสำเร็จ' });
    }

    // ─── toggle_status ──────────────────────────────────────────────────────
    if (action === 'toggle_status') {
      const { user_id, banned } = body;
      if (!user_id || banned === undefined) return jsonError('user_id และ banned จำเป็นต้องระบุ', 400);

      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: banned ? '87600h' : 'none',
      });
      if (error) throw error;

      return jsonOk({ message: banned ? 'ปิดบัญชีสำเร็จ' : 'เปิดบัญชีสำเร็จ' });
    }

    return jsonError(`action "${action}" ไม่รองรับ`, 400);
  } catch (err: unknown) {
    const raw = err as Record<string, unknown>;
    const message =
      err instanceof Error
        ? err.message
        : typeof raw?.message === 'string'
          ? raw.message
          : typeof raw?.error === 'string'
            ? raw.error
            : typeof raw?.details === 'string'
              ? raw.details
              : JSON.stringify(err);
    console.error('[admin-staff-management]', message);
    console.error('[admin-staff-management] full error:', JSON.stringify(raw));
    return jsonError(message, 500);
  }
});

function jsonOk(data: unknown) {
  return new Response(JSON.stringify({ success: true, ...data as object }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
