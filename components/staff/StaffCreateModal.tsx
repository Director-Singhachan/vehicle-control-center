import React, { useState, useEffect } from 'react';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { AppRole } from '../../types/database';
import type { CreateStaffInput } from '../../services/adminStaffService';
import type { Database } from '../../types/database';

type ServiceStaffRow = Database['public']['Tables']['service_staff']['Row'];

interface StaffCreateModalProps {
  isOpen: boolean;
  branches: string[];
  /** รายชื่อพนักงานบริการ/คนขับที่ยังไม่มีบัญชี — สำหรับผูกบัญชีกับรายชื่อเดิม (รักษาประวัติทริป) */
  unlinkedServiceStaff: ServiceStaffRow[];
  submitting: boolean;
  onSubmit: (input: CreateStaffInput) => void;
  onClose: () => void;
}

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
  'w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-enterprise-500';

const OPERATIONAL_ROLES: AppRole[] = ['driver', 'service_staff'];

export const StaffCreateModal: React.FC<StaffCreateModalProps> = ({
  isOpen,
  branches,
  unlinkedServiceStaff = [],
  submitting,
  onSubmit,
  onClose,
}) => {
  const [form, setForm] = useState({
    employee_code: '',
    full_name: '',
    role: 'driver' as AppRole,
    link_service_staff_id: '' as string,
    branch: '',
    department: '',
    position: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm({ employee_code: '', full_name: '', role: 'driver', link_service_staff_id: '', branch: '', department: '', position: '', phone: '', password: '', confirm_password: '' });
      setErrors({});
    }
  }, [isOpen]);

  const showLinkOption = OPERATIONAL_ROLES.includes(form.role) && unlinkedServiceStaff.length > 0;

  const handleLinkStaffChange = (staffId: string) => {
    if (!staffId) {
      setForm((f) => ({ ...f, link_service_staff_id: '', employee_code: f.employee_code, full_name: f.full_name, phone: f.phone }));
      return;
    }
    const staff = unlinkedServiceStaff.find((s) => s.id === staffId);
    if (staff) {
      setForm((f) => ({
        ...f,
        link_service_staff_id: staffId,
        employee_code: staff.employee_code || f.employee_code,
        full_name: staff.name || f.full_name,
        phone: staff.phone || f.phone,
      }));
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.employee_code.trim()) e.employee_code = 'กรุณาระบุรหัสพนักงาน';
    if (!form.full_name.trim()) e.full_name = 'กรุณาระบุชื่อ-นามสกุล';
    if (!form.password) e.password = 'กรุณาระบุรหัสผ่าน';
    else if (form.password.length < 6) e.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (form.password !== form.confirm_password) e.confirm_password = 'รหัสผ่านไม่ตรงกัน';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: CreateStaffInput = {
      full_name: form.full_name.trim(),
      role: form.role,
      employee_code: form.employee_code.trim(),
      branch: form.branch.trim() || undefined,
      department: form.department.trim() || undefined,
      position: form.position.trim() || undefined,
      phone: form.phone.trim() || undefined,
      password: form.password,
    };
    if (form.link_service_staff_id.trim()) payload.link_service_staff_id = form.link_service_staff_id.trim();
    onSubmit(payload);
  };

  const emailPreview = form.employee_code.trim() ? `${form.employee_code.trim()}@staff.local` : '—';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="สร้างพนักงานใหม่" size="medium">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee code + Email preview */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              รหัสพนักงาน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.employee_code}
              onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))}
              placeholder="เช่น 000001 หรือรหัสเดิม"
              className={inputCls}
            />
            {errors.employee_code && <p className="mt-1 text-xs text-red-500">{errors.employee_code}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Email (สร้างอัตโนมัติ)
            </label>
            <div className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 truncate font-mono">
              {emailPreview}
            </div>
          </div>
        </div>

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            ชื่อ-นามสกุล <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="เช่น สมชาย ใจดี"
            className={inputCls}
          />
          {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name}</p>}
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            บทบาท <span className="text-red-500">*</span>
          </label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole, link_service_staff_id: '' }))}
            className={inputCls}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* ผูกกับรายชื่อเดิม (เมื่อเลือกคนขับ/พนักงานบริการ และมีรายชื่อที่ยังไม่มีบัญชี) */}
        {showLinkOption && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              ผูกกับรายชื่อเดิม (รักษาประวัติทริป)
            </label>
            <select
              value={form.link_service_staff_id}
              onChange={(e) => handleLinkStaffChange(e.target.value)}
              className={inputCls}
            >
              <option value="">— สร้างรายชื่อใหม่ —</option>
              {unlinkedServiceStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.employee_code ? `(${s.employee_code})` : ''} {s.phone ? `· ${s.phone}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              เลือกรายชื่อที่เคยสร้างใน จัดการพนักงาน แล้วจะผูกบัญชีกับรายชื่อเดิม ประวัติทริปไม่หาย
            </p>
          </div>
        )}

        {/* Branch */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            สาขา
          </label>
          <input
            type="text"
            list="create-branch-list"
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            placeholder="เช่น สาขา HQ, สาขา SD"
            className={inputCls}
          />
          <datalist id="create-branch-list">
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
              placeholder="เช่น ขนส่ง, บัญชี"
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
              placeholder="เช่น หัวหน้าทีมขนส่ง, พนักงานขับรถ"
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
            placeholder="0812345678"
            className={inputCls}
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            รหัสผ่านเริ่มต้น <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.confirm_password}
            onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            className={inputCls}
          />
          {errors.confirm_password && (
            <p className="mt-1 text-xs text-red-500">{errors.confirm_password}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" isLoading={submitting}>
            <UserPlus size={16} className="mr-1.5" />
            สร้างพนักงาน
          </Button>
        </div>
      </form>
    </Modal>
  );
};
