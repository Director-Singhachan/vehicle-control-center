import React, { useState, useEffect } from 'react';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { AppRole } from '../../types/database';
import type { CreateStaffInput } from '../../services/adminStaffService';

interface StaffCreateModalProps {
  isOpen: boolean;
  nextCode: string;
  branches: string[];
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

export const StaffCreateModal: React.FC<StaffCreateModalProps> = ({
  isOpen,
  nextCode,
  branches,
  submitting,
  onSubmit,
  onClose,
}) => {
  const [form, setForm] = useState({
    full_name: '',
    role: 'driver' as AppRole,
    branch: '',
    department: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm({ full_name: '', role: 'driver', branch: '', department: '', phone: '', password: '', confirm_password: '' });
      setErrors({});
    }
  }, [isOpen]);

  const validate = () => {
    const e: Record<string, string> = {};
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
    onSubmit({
      full_name: form.full_name.trim(),
      role: form.role,
      branch: form.branch.trim() || undefined,
      department: form.department.trim() || undefined,
      phone: form.phone.trim() || undefined,
      password: form.password,
    });
  };

  const emailPreview = nextCode ? `${nextCode}@staff.local` : 'กำลังโหลด...';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="สร้างพนักงานใหม่" size="medium">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Code + Email preview */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              รหัสพนักงาน (auto)
            </label>
            <div className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-enterprise-600 dark:text-enterprise-400">
              {nextCode || '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Email (auto)
            </label>
            <div className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 truncate">
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
            list="create-branch-list"
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            placeholder="เช่น สาขากรุงเทพ, สาขาชลบุรี"
            className={inputCls}
          />
          <datalist id="create-branch-list">
            {branches.map((b) => <option key={b} value={b} />)}
          </datalist>
        </div>

        {/* Department + Phone */}
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
