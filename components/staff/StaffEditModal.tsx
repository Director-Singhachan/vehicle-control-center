import React, { useState, useEffect } from 'react';
import { Save, ArrowRightLeft, AlertTriangle, Link2, Link2Off, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { AppRole } from '../../types/database';
import type { StaffProfile, UpdateStaffInput } from '../../services/adminStaffService';
import type { Database } from '../../types/database';

type ServiceStaffRow = Database['public']['Tables']['service_staff']['Row'];

interface StaffEditModalProps {
  staff: StaffProfile | null;
  branches: string[];
  submitting: boolean;
  /** รายชื่อพนักงานทั้งหมดสำหรับ dropdown ผูก (โหลดเมื่อเปิด modal) */
  allServiceStaff: ServiceStaffRow[];
  /** record ที่ผูกกับ staff.id อยู่ในปัจจุบัน */
  linkedServiceStaff: ServiceStaffRow | null;
  relinkLoading: boolean;
  onSubmit: (userId: string, input: UpdateStaffInput) => void;
  onMigrateEmail: (userId: string, employeeCode: string) => void;
  onRelink: (userId: string, serviceStaffId: string) => void;
  onClose: () => void;
}

const LEGACY_EMAIL_DOMAINS = ['@driver.local', '@sales.local', '@service.local'];
const isLegacyEmail = (email: string | null | undefined) =>
  !!email && LEGACY_EMAIL_DOMAINS.some((d) => email.endsWith(d));

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin (ผู้ดูแลระบบ)' },
  { value: 'executive', label: 'Executive (ผู้บริหาร)' },
  { value: 'manager', label: 'Manager (ผู้จัดการ)' },
  { value: 'hr', label: 'HR (บุคคล)' },
  { value: 'accounting', label: 'Accounting (บัญชี/จัดซื้อ)' },
  { value: 'warehouse', label: 'Warehouse (คลังสินค้า)' },
  { value: 'driver', label: 'Driver (คนขับ)' },
  { value: 'service_staff', label: 'Service Staff (พนักงานบริการ)' },
  { value: 'sales', label: 'Sales (ขาย)' },
  { value: 'inspector', label: 'Inspector (ตรวจสอบ)' },
  { value: 'user', label: 'User (ผู้ใช้ทั่วไป)' },
];

const OPERATIONAL_ROLES: AppRole[] = ['driver', 'service_staff'];

const NAME_PREFIX_OPTIONS = ['', 'นาย', 'นาง', 'นางสาว'];

const inputCls =
  'w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500';

export const StaffEditModal: React.FC<StaffEditModalProps> = ({
  staff,
  branches,
  submitting,
  allServiceStaff,
  linkedServiceStaff,
  relinkLoading,
  onSubmit,
  onMigrateEmail,
  onRelink,
  onClose,
}) => {
  const [form, setForm] = useState({ name_prefix: '', full_name: '', role: 'user' as AppRole, branch: '', department: '', position: '', phone: '', employee_code: '', email: '' });
  const [migrateCode, setMigrateCode] = useState('');
  const [showMigrateForm, setShowMigrateForm] = useState(false);

  // Relink state
  const [showRelinkSection, setShowRelinkSection] = useState(false);
  const [selectedRelinkId, setSelectedRelinkId] = useState('');
  const [relinkSearch, setRelinkSearch] = useState('');

  useEffect(() => {
    if (staff) {
      setForm({
        name_prefix: staff.name_prefix || '',
        full_name: staff.full_name || '',
        role: staff.role,
        branch: staff.branch || '',
        department: staff.department || '',
        position: (staff as any).position || '',
        phone: staff.phone || '',
        employee_code: staff.employee_code || '',
        email: staff.email || '',
      });
      setMigrateCode('');
      setShowMigrateForm(false);
      setShowRelinkSection(false);
      setSelectedRelinkId('');
      setRelinkSearch('');
    }
  }, [staff]);

  if (!staff) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpdateStaffInput = {
      full_name: form.full_name.trim() || undefined,
      role: form.role,
      branch: form.branch.trim() || undefined,
      department: form.department.trim() || undefined,
      position: form.position.trim() || undefined,
      phone: form.phone.trim() || undefined,
    };
    
    // Email is read-only in Edit Modal (Auth update disabled)
    
    // ส่ง name_prefix เฉพาะเมื่อมีค่าจาก server หรือผู้ใช้เลือกแล้ว (ไม่ส่ง null ไปทับค่าที่มีอยู่)
    if (staff?.name_prefix !== undefined || form.name_prefix !== '') {
      payload.name_prefix = form.name_prefix || null;
    }
    if (form.employee_code.trim() !== (staff?.employee_code || '')) {
      payload.employee_code = form.employee_code.trim() || null;
    }
    onSubmit(staff.id, payload);
  };

  const legacy = isLegacyEmail(staff?.email);

  const handleMigrateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff || !migrateCode.trim()) return;
    onMigrateEmail(staff.id, migrateCode.trim());
  };

  const handleRelinkSubmit = () => {
    if (!selectedRelinkId) return;
    onRelink(staff.id, selectedRelinkId);
  };

  const isOperational = OPERATIONAL_ROLES.includes(form.role);

  // Filter service_staff list for search
  const filteredForRelink = allServiceStaff.filter(s => {
    if (!relinkSearch) return true;
    const q = relinkSearch.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.employee_code || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    );
  });

  // Find the currently selected record in the dropdown
  const selectedRecord = allServiceStaff.find(s => s.id === selectedRelinkId);
  const isRelinkingToSame = linkedServiceStaff && selectedRelinkId === linkedServiceStaff.id;
  const willReplaceOtherUser = selectedRecord?.user_id && selectedRecord.user_id !== staff.id;

  return (
    <Modal isOpen={!!staff} onClose={onClose} title="แก้ไขข้อมูลพนักงาน" size="medium">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Legacy email migration banner */}
        {legacy && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Email รูปแบบเก่า — ยังไม่มีรหัสพนักงาน
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  พนักงานนี้ใช้ email <span className="font-mono">{staff?.email}</span> ซึ่งเป็นรูปแบบเดิม
                  กรอกรหัสพนักงานเพื่อย้ายเป็น <span className="font-mono">&lt;รหัส&gt;@staff.local</span> โดยไม่เสียประวัติทริป
                </p>
              </div>
            </div>
            {!showMigrateForm ? (
              <button
                type="button"
                onClick={() => setShowMigrateForm(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2"
              >
                <ArrowRightLeft size={13} />
                ย้ายรูปแบบ Email
              </button>
            ) : (
              <div className="flex gap-2 items-end pt-1">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                    รหัสพนักงานใหม่
                  </label>
                  <input
                    type="text"
                    value={migrateCode}
                    onChange={(e) => setMigrateCode(e.target.value)}
                    placeholder="เช่น 000001"
                    maxLength={20}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-amber-400 dark:border-amber-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    Email ใหม่จะเป็น <span className="font-mono">{migrateCode.trim() || '...'}{migrateCode.trim() ? '@staff.local' : ''}</span>
                  </p>
                </div>
                <div className="flex gap-1.5 pb-6">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowMigrateForm(false); setMigrateCode(''); }}
                    disabled={submitting}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleMigrateSubmit}
                    isLoading={submitting}
                    disabled={!migrateCode.trim()}
                  >
                    <ArrowRightLeft size={13} className="mr-1" />
                    ย้าย Email
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Email (read-only) + รหัสพนักงาน (แก้ไขได้ — กรณีใช้อีเมลจริงแต่ยังไม่มีรหัส) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              รหัสพนักงาน
            </label>
            <input
              type="text"
              value={form.employee_code}
              onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))}
              placeholder="ตัวอักษรหรือตัวเลข 2–20 ตัว"
              maxLength={20}
              className={inputCls + ' font-mono'}
            />
            {!staff.employee_code && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                ตั้งรหัสได้ — อีเมลจะไม่เปลี่ยน
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              readOnly
              className={`${inputCls} bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed`}
            />
          </div>
        </div>

        {/* คำนำหน้า + ชื่อ-นามสกุล */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            ชื่อ-นามสกุล
          </label>
          <div className="flex gap-2">
            <select
              value={form.name_prefix}
              onChange={(e) => setForm((f) => ({ ...f, name_prefix: e.target.value }))}
              className={`${inputCls} w-36 flex-shrink-0`}
            >
              {NAME_PREFIX_OPTIONS.map((p) => (
                <option key={p} value={p}>{p || '— คำนำหน้า —'}</option>
              ))}
            </select>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            บทบาท
          </label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
            className={inputCls}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Branch */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            สาขา
          </label>
          <input
            type="text"
            list="edit-branch-list"
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            placeholder="เช่น สาขากรุงเทพ, สาขาชลบุรี"
            className={inputCls}
          />
          <datalist id="edit-branch-list">
            {branches.map((b) => <option key={b} value={b} />)}
          </datalist>
        </div>

        {/* Department + Position */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              แผนก
            </label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              ตำแหน่ง
            </label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="เช่น หัวหน้าทีมขนส่ง"
              className={inputCls}
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            เบอร์โทร
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputCls}
          />
        </div>

        {/* ─── ผูกรายชื่อพนักงาน (driver / service_staff เท่านั้น) ─────────── */}
        {isOperational && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRelinkSection(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Link2 size={15} className="text-enterprise-500" />
                ผูกรายชื่อพนักงาน (ประวัติทริป)
              </span>
              <span className="text-xs font-normal">
                {linkedServiceStaff
                  ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 size={13} />ผูกแล้ว: {linkedServiceStaff.name}</span>
                  : <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><Link2Off size={13} />ยังไม่ผูก</span>
                }
              </span>
            </button>

            {showRelinkSection && (
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                {/* สถานะปัจจุบัน */}
                {linkedServiceStaff ? (
                  <div className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20 text-xs text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold">ผูกอยู่กับ:</span> {linkedServiceStaff.name}
                      {linkedServiceStaff.employee_code && <span className="ml-1 font-mono">({linkedServiceStaff.employee_code})</span>}
                      {linkedServiceStaff.branch && <span className="ml-1 opacity-70">· {linkedServiceStaff.branch}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Link2Off size={13} className="mt-0.5 shrink-0" />
                    <span>บัญชีนี้ยังไม่ได้ผูกกับรายชื่อพนักงานใด — ประวัติทริปและค่าคอมมาจะไม่เชื่อมกัน</span>
                  </div>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  เลือกรายชื่อที่ต้องการผูก — ระบบจะเชื่อมประวัติทริปและค่าคอมมาของรายชื่อนั้นกับบัญชีนี้
                </p>

                {/* Search */}
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร..."
                  value={relinkSearch}
                  onChange={(e) => setRelinkSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                />

                {/* Dropdown */}
                <select
                  value={selectedRelinkId}
                  onChange={(e) => setSelectedRelinkId(e.target.value)}
                  size={Math.min(6, filteredForRelink.length + 1)}
                  className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                >
                  <option value="">— เลือกรายชื่อ —</option>
                  {filteredForRelink.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.employee_code ? ` (${s.employee_code})` : ''}
                      {s.branch ? ` · ${s.branch}` : ''}
                      {s.user_id && s.user_id !== staff.id ? ' ⚠ มีบัญชีผูกอยู่' : ''}
                      {s.user_id === staff.id ? ' ✓ ผูกอยู่' : ''}
                    </option>
                  ))}
                </select>

                {/* Warning: re-linking from another user */}
                {willReplaceOtherUser && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      รายชื่อนี้มีบัญชีอื่นผูกอยู่แล้ว — หากยืนยัน บัญชีเดิมจะสูญเสียการเชื่อมโยงกับรายชื่อนี้
                    </span>
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={handleRelinkSubmit}
                  isLoading={relinkLoading}
                  disabled={!selectedRelinkId || isRelinkingToSame || relinkLoading}
                  className="w-full"
                >
                  <RefreshCw size={13} className="mr-1.5" />
                  {isRelinkingToSame ? 'รายชื่อนี้ผูกอยู่แล้ว' : 'ยืนยันการผูกรายชื่อ'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" isLoading={submitting}>
            <Save size={16} className="mr-1.5" />
            บันทึก
          </Button>
        </div>
      </form>
    </Modal>
  );
};
