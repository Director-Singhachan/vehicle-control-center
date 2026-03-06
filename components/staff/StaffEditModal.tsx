import React, { useState, useEffect } from 'react';
import { Save, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { AppRole } from '../../types/database';
import type { StaffProfile, UpdateStaffInput } from '../../services/adminStaffService';

interface StaffEditModalProps {
  staff: StaffProfile | null;
  branches: string[];
  submitting: boolean;
  onSubmit: (userId: string, input: UpdateStaffInput) => void;
  onMigrateEmail: (userId: string, employeeCode: string) => void;
  onClose: () => void;
}

const LEGACY_EMAIL_DOMAINS = ['@driver.local', '@sales.local', '@service.local'];
const isLegacyEmail = (email: string | null | undefined) =>
  !!email && LEGACY_EMAIL_DOMAINS.some((d) => email.endsWith(d));

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin (ผู้ดูแลระบบ)' },
  { value: 'manager', label: 'Manager (ผู้จัดการ)' },
  { value: 'hr', label: 'HR (บุคคล)' },
  { value: 'accounting', label: 'Accounting (บัญชี)' },
  { value: 'warehouse', label: 'Warehouse (คลังสินค้า)' },
  { value: 'driver', label: 'Driver (คนขับ)' },
  { value: 'service_staff', label: 'Service Staff (พนักงานบริการ)' },
  { value: 'sales', label: 'Sales (ขาย)' },
  { value: 'inspector', label: 'Inspector (ตรวจสอบ)' },
  { value: 'user', label: 'User (ผู้ใช้ทั่วไป)' },
];

const inputCls =
  'w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500';

export const StaffEditModal: React.FC<StaffEditModalProps> = ({
  staff,
  branches,
  submitting,
  onSubmit,
  onMigrateEmail,
  onClose,
}) => {
  const [form, setForm] = useState({ full_name: '', role: 'user' as AppRole, branch: '', department: '', position: '', phone: '' });
  const [migrateCode, setMigrateCode] = useState('');
  const [showMigrateForm, setShowMigrateForm] = useState(false);

  useEffect(() => {
    if (staff) {
      setForm({
        full_name: staff.full_name || '',
        role: staff.role,
        branch: staff.branch || '',
        department: staff.department || '',
        position: (staff as any).position || '',
        phone: staff.phone || '',
      });
      setMigrateCode('');
      setShowMigrateForm(false);
    }
  }, [staff]);

  if (!staff) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(staff.id, {
      full_name: form.full_name.trim() || undefined,
      role: form.role,
      branch: form.branch.trim() || undefined,
      department: form.department.trim() || undefined,
      position: form.position.trim() || undefined,
      phone: form.phone.trim() || undefined,
    });
  };

  const legacy = isLegacyEmail(staff?.email);

  const handleMigrateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff || !migrateCode.trim()) return;
    onMigrateEmail(staff.id, migrateCode.trim());
  };

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

        {/* Read-only info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              รหัสพนักงาน
            </label>
            <div className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-enterprise-600 dark:text-enterprise-400">
              {staff.employee_code || '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Email
            </label>
            <div className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 truncate">
              {staff.email || '—'}
            </div>
          </div>
        </div>

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            ชื่อ-นามสกุล
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className={inputCls}
          />
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
