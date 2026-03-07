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

    const body = await req.json();
    const { action } = body;

    // ─── set_own_employee_code — ใช้ได้เฉพาะ Admin/HR (นโยบาย: ให้เฉพาะ Admin/HR ตั้งรหัส) ───
    if (action === 'set_own_employee_code') {
      if (callerProfile.role !== 'admin' && callerProfile.role !== 'hr') {
        return jsonError('Forbidden: ตั้งรหัสพนักงานได้เฉพาะ Admin หรือ HR เท่านั้น', 403);
      }
      const { employee_code: rawCode } = body;
      const employee_code = typeof rawCode === 'string' ? rawCode.trim() : '';

      if (!employee_code) {
        return jsonError('รหัสพนักงานจำเป็นต้องระบุ', 400);
      }
      if (!/^[a-zA-Z0-9]{2,20}$/.test(employee_code)) {
        return jsonError('รหัสพนักงานต้องประกอบด้วยตัวเลขและตัวอักษรเท่านั้น (ความยาว 2–20 ตัว)', 400);
      }

      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('employee_code', employee_code)
        .neq('id', callerUser.id)
        .limit(1)
        .maybeSingle();

      if (existingProfile) {
        return jsonError('รหัสพนักงานนี้มีในระบบแล้ว กรุณาเลือกรหัสอื่น', 409);
      }

      const { error: updateErr } = await adminClient
        .from('profiles')
        .update({ employee_code })
        .eq('id', callerUser.id);
      if (updateErr) throw updateErr;

      await adminClient
        .from('service_staff')
        .update({ employee_code })
        .eq('user_id', callerUser.id);

      return jsonOk({ message: 'บันทึกรหัสพนักงานสำเร็จ', employee_code });
    }

    // ─── Actions ต่อไปนี้ต้องการสิทธิ์ Admin หรือ HR ────────────────────────
    if (callerProfile.role !== 'admin' && callerProfile.role !== 'hr') {
      return jsonError('Forbidden: ต้องเป็น Admin หรือ HR เท่านั้น', 403);
    }

    // ─── next_employee_code ─────────────────────────────────────────────────
    if (action === 'next_employee_code') {
      const { data, error } = await adminClient.rpc('get_next_employee_code');
      if (error) throw error;
      return jsonOk({ employee_code: data });
    }

    // ─── create_user ────────────────────────────────────────────────────────
    if (action === 'create_user') {
      const {
        full_name,
        role,
        branch,
        department,
        position,
        phone,
        password,
        employee_code: rawCode,
        link_service_staff_id,
        email: rawEmail,
      } = body;

      if (!full_name || !role || !password) {
        return jsonError('full_name, role และ password จำเป็นต้องระบุ', 400);
      }

      const employee_code = typeof rawCode === 'string' ? rawCode.trim() : '';
      if (!employee_code) {
        return jsonError('รหัสพนักงานจำเป็นต้องระบุ', 400);
      }

      // ตรวจรหัสไม่ซ้ำ (ใน profiles)
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('employee_code', employee_code)
        .limit(1)
        .maybeSingle();
      if (existingProfile) {
        return jsonError('รหัสพนักงานนี้มีในระบบแล้ว', 400);
      }

      let email = '';
      if (typeof rawEmail === 'string') {
        email = rawEmail.trim();
      }
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return jsonError('รูปแบบ Email ไม่ถูกต้อง', 400);
        }
        // ตรวจ email ไม่ซ้ำ (ใน profiles)
        const { data: existingEmail } = await adminClient
          .from('profiles')
          .select('id')
          .eq('email', email)
          .limit(1)
          .maybeSingle();
        if (existingEmail) {
          return jsonError('Email นี้มีในระบบแล้ว', 400);
        }
      } else {
        email = `${employee_code}${STAFF_EMAIL_DOMAIN}`;
      }

      // ถ้าส่ง link_service_staff_id มา = ผูกบัญชีกับรายชื่อเดิม (รักษาประวัติทริป)
      const linkId = typeof link_service_staff_id === 'string' ? link_service_staff_id.trim() || null : null;
      if (linkId && OPERATIONAL_ROLES.has(role)) {
        const { data: existingRow, error: linkCheckErr } = await adminClient
          .from('service_staff')
          .select('id')
          .eq('id', linkId)
          .is('user_id', null)
          .maybeSingle();
        if (linkCheckErr || !existingRow) {
          return jsonError('ไม่พบรายชื่อพนักงานที่เลือก หรือรายชื่อนี้ผูกบัญชีแล้ว', 400);
        }
      }

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
        position: position || null,
        phone: phone || null,
        employee_code,
      }, { onConflict: 'id' });
      if (profileInsertErr) {
        await adminClient.auth.admin.deleteUser(userId);
        throw profileInsertErr;
      }

      if (OPERATIONAL_ROLES.has(role)) {
        if (linkId) {
          // ผูกบัญชีกับรายชื่อเดิม → UPDATE (รักษาประวัติทริป)
          const { error: ssUpdateErr } = await adminClient.from('service_staff').update({
            user_id: userId,
            name: full_name,
            phone: phone || null,
            employee_code,
            branch: branch || null,
            updated_at: new Date().toISOString(),
          }).eq('id', linkId);
          if (ssUpdateErr) {
            console.warn('[admin-staff] Failed to link service_staff:', ssUpdateErr.message);
            await adminClient.auth.admin.deleteUser(userId);
            throw ssUpdateErr;
          }
        } else {
          // สร้างรายชื่อใหม่
          const { error: ssErr } = await adminClient.from('service_staff').insert({
            name: full_name,
            phone: phone || null,
            employee_code,
            user_id: userId,
            branch: branch || null,
            status: 'active',
          });
          if (ssErr) console.warn('[admin-staff] Failed to create service_staff record:', ssErr.message);
        }
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
      const { user_id, full_name, role, branch, department, position, phone, employee_code: rawEmployeeCode } = body;
      if (!user_id) return jsonError('user_id จำเป็นต้องระบุ', 400);

      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined) updates.role = role;
      if (branch !== undefined) updates.branch = branch;
      if (department !== undefined) updates.department = department;
      if (position !== undefined) updates.position = position;
      if (phone !== undefined) updates.phone = phone;

      // รองรับการตั้ง/แก้รหัสพนักงานโดย Admin (กรณีใช้อีเมลจริงแต่ยังไม่มีรหัส)
      if (rawEmployeeCode !== undefined) {
        const employee_code = typeof rawEmployeeCode === 'string' ? rawEmployeeCode.trim() : '';
        if (employee_code !== '') {
          if (!/^[a-zA-Z0-9]{2,20}$/.test(employee_code)) {
            return jsonError('รหัสพนักงานต้องเป็นตัวอักษรหรือตัวเลข 2–20 ตัวเท่านั้น', 400);
          }
          const { data: existingProfile } = await adminClient
            .from('profiles')
            .select('id')
            .eq('employee_code', employee_code)
            .neq('id', user_id)
            .limit(1)
            .maybeSingle();
          if (existingProfile) {
            return jsonError('รหัสพนักงานนี้มีในระบบแล้ว กรุณาเลือกรหัสอื่น', 409);
          }
          updates.employee_code = employee_code;
        } else {
          updates.employee_code = null;
        }
      }

      const { error } = await adminClient.from('profiles').update(updates).eq('id', user_id);
      if (error) throw error;

      // Sync name/branch/employee_code to service_staff if linked
      const ssSync: Record<string, unknown> = {};
      if (full_name !== undefined) { ssSync.name = full_name; ssSync.phone = phone ?? null; }
      if (branch !== undefined) ssSync.branch = branch || null;
      if (updates.employee_code !== undefined) ssSync.employee_code = updates.employee_code;
      if (Object.keys(ssSync).length > 0) {
        ssSync.updated_at = new Date().toISOString();
        await adminClient
          .from('service_staff')
          .update(ssSync)
          .eq('user_id', user_id);
      }

      return jsonOk({ message: 'อัปเดตข้อมูลสำเร็จ' });
    }

    // ─── migrate_email ──────────────────────────────────────────────────────
    // เปลี่ยน email รูปแบบเก่า (เช่น @driver.local) เป็น {employee_code}@staff.local
    // โดยไม่สร้าง user ใหม่ — ประวัติทริปยังคงอยู่
    if (action === 'migrate_email') {
      const { user_id, employee_code: rawCode } = body;
      if (!user_id) return jsonError('user_id จำเป็นต้องระบุ', 400);

      const employee_code = typeof rawCode === 'string' ? rawCode.trim() : '';
      if (!employee_code) return jsonError('รหัสพนักงานจำเป็นต้องระบุ', 400);
      if (!/^[a-zA-Z0-9]{2,20}$/.test(employee_code)) {
        return jsonError('รหัสพนักงานต้องประกอบด้วยตัวเลขและตัวอักษรเท่านั้น (ความยาว 2–20 ตัว)', 400);
      }

      // ตรวจว่า employee_code ไม่ซ้ำกับ user อื่น
      const { data: existingCode } = await adminClient
        .from('profiles')
        .select('id')
        .eq('employee_code', employee_code)
        .neq('id', user_id)
        .limit(1)
        .maybeSingle();
      if (existingCode) return jsonError('รหัสพนักงานนี้มีในระบบแล้ว กรุณาเลือกรหัสอื่น', 409);

      const newEmail = `${employee_code}${STAFF_EMAIL_DOMAIN}`;

      // ตรวจว่า email ใหม่ไม่ซ้ำกับ user อื่น
      const { data: existingEmail } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', newEmail)
        .neq('id', user_id)
        .limit(1)
        .maybeSingle();
      if (existingEmail) return jsonError('Email นี้มีในระบบแล้ว', 409);

      // เปลี่ยน email ใน auth
      const { error: authUpdateErr } = await adminClient.auth.admin.updateUserById(user_id, {
        email: newEmail,
        email_confirm: true,
      });
      if (authUpdateErr) throw authUpdateErr;

      // อัปเดต profiles
      const { error: profileUpdateErr } = await adminClient
        .from('profiles')
        .update({ email: newEmail, employee_code })
        .eq('id', user_id);
      if (profileUpdateErr) throw profileUpdateErr;

      // Sync service_staff ถ้าผูกบัญชีอยู่
      await adminClient
        .from('service_staff')
        .update({ employee_code })
        .eq('user_id', user_id);

      return jsonOk({ message: 'ย้ายรูปแบบ Email สำเร็จ', email: newEmail, employee_code });
    }

    // ─── toggle_status ──────────────────────────────────────────────────────
    if (action === 'toggle_status') {
      const { user_id, banned } = body;
      if (!user_id || banned === undefined) return jsonError('user_id และ banned จำเป็นต้องระบุ', 400);

      // เปลี่ยนสถานะใน auth
      const { error: authErr } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: banned ? '87600h' : 'none',
      });
      if (authErr) throw authErr;

      // Sync สถานะลง profiles ให้ frontend query ได้โดยตรง
      const { error: profileErr } = await adminClient
        .from('profiles')
        .update({ is_banned: banned })
        .eq('id', user_id);
      if (profileErr) console.warn('[admin-staff] Failed to sync is_banned to profiles:', profileErr.message);

      return jsonOk({ message: banned ? 'ปิดบัญชีสำเร็จ' : 'เปิดบัญชีสำเร็จ' });
    }

    // ─── relink_service_staff ────────────────────────────────────────────────
    // เชื่อม / ย้ายการผูกระหว่าง profiles กับ service_staff (แม้ record นั้นจะมี user_id อยู่แล้ว)
    if (action === 'relink_service_staff') {
      const { user_id, service_staff_id } = body;
      if (!user_id) return jsonError('user_id จำเป็นต้องระบุ', 400);
      if (!service_staff_id) return jsonError('service_staff_id จำเป็นต้องระบุ', 400);

      // ตรวจว่า profile มีอยู่จริงและเป็น role ที่ใช้ service_staff
      const { data: targetProfile, error: profileErr } = await adminClient
        .from('profiles')
        .select('id, role, full_name, phone, employee_code, branch')
        .eq('id', user_id)
        .single();
      if (profileErr || !targetProfile) return jsonError('ไม่พบ profile ที่ระบุ', 404);
      if (!OPERATIONAL_ROLES.has(targetProfile.role)) {
        return jsonError('สามารถผูกได้เฉพาะ role: driver หรือ service_staff เท่านั้น', 400);
      }

      // ตรวจว่า service_staff record มีอยู่จริง
      const { data: ssRow, error: ssCheckErr } = await adminClient
        .from('service_staff')
        .select('id, user_id')
        .eq('id', service_staff_id)
        .single();
      if (ssCheckErr || !ssRow) return jsonError('ไม่พบรายชื่อพนักงานที่ระบุ', 404);

      // อัปเดต service_staff → ผูกกับ user ใหม่ + sync ข้อมูลจาก profile
      const { error: relinkErr } = await adminClient
        .from('service_staff')
        .update({
          user_id,
          name: targetProfile.full_name || undefined,
          phone: targetProfile.phone || null,
          employee_code: targetProfile.employee_code || null,
          branch: targetProfile.branch || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service_staff_id);
      if (relinkErr) throw relinkErr;

      return jsonOk({
        message: 'ผูกรายชื่อพนักงานสำเร็จ',
        service_staff_id,
        user_id,
        previous_user_id: ssRow.user_id,
      });
    }

    // ─── delete_user ────────────────────────────────────────────────────────
    // Soft-delete บัญชี: ล้างข้อมูลส่วนตัว + แบนถาวร + ซ่อนจากรายการ
    // ไม่ hard-delete เนื่องจาก ticket_approvals / tickets มี FK RESTRICT ไปยัง profiles
    if (action === 'delete_user') {
      if (callerProfile.role !== 'admin' && callerProfile.role !== 'hr') {
        return jsonError('Forbidden: ต้องเป็น Admin หรือ HR เท่านั้นจึงจะลบบัญชีได้', 403);
      }

      const { user_id } = body;
      if (!user_id) return jsonError('user_id จำเป็นต้องระบุ', 400);

      // ป้องกันการลบตัวเอง
      if (user_id === callerUser.id) {
        return jsonError('ไม่สามารถลบบัญชีของตัวเองได้', 400);
      }

      // 1. ถอด user_id ออกจาก service_staff (รักษาประวัติทริป)
      await adminClient
        .from('service_staff')
        .update({ user_id: null })
        .eq('user_id', user_id);

      // 2. Anonymize + soft-delete profile (ล้างข้อมูลส่วนตัว)
      const deletedAt = new Date().toISOString();
      const { error: profileErr } = await adminClient.from('profiles').update({
        full_name: 'ผู้ใช้ที่ถูกลบ',
        phone: null,
        branch: null,
        department: null,
        position: null,
        employee_code: null,
        is_banned: true,
        deleted_at: deletedAt,
      }).eq('id', user_id);
      if (profileErr) throw profileErr;

      // 3. แบนถาวรใน auth (ป้องกัน login)
      await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: '876000h',
      });

      return jsonOk({ message: 'ลบบัญชีสำเร็จ' });
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
