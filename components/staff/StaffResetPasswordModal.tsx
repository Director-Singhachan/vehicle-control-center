import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { StaffProfile } from '../../services/adminStaffService';

interface StaffResetPasswordModalProps {
  staff: StaffProfile | null;
  submitting: boolean;
  onSubmit: (userId: string, newPassword: string) => void;
  onClose: () => void;
}

const inputCls =
  'w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500';

export const StaffResetPasswordModal: React.FC<StaffResetPasswordModalProps> = ({
  staff,
  submitting,
  onSubmit,
  onClose,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  useEffect(() => {
    if (staff) {
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    }
  }, [staff]);

  if (!staff) return null;

  const validate = () => {
    const e: { password?: string; confirm?: string } = {};
    if (!newPassword) e.password = 'กรุณาระบุรหัสผ่านใหม่';
    else if (newPassword.length < 6) e.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (newPassword !== confirmPassword) e.confirm = 'รหัสผ่านไม่ตรงกัน';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(staff.id, newPassword);
  };

  return (
    <Modal isOpen={!!staff} onClose={onClose} title="รีเซ็ตรหัสผ่าน" size="small">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Staff info */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-enterprise-100 dark:bg-enterprise-900/60 flex items-center justify-center font-bold text-enterprise-600 dark:text-enterprise-400 flex-shrink-0">
            {(staff.full_name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
              {staff.full_name || '—'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              รหัส {staff.employee_code || '—'} · {staff.email}
            </div>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            รหัสผ่านใหม่ <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              className={`${inputCls} pr-10`}
              autoFocus
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
            ยืนยันรหัสผ่านใหม่ <span className="text-red-500">*</span>
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            className={inputCls}
          />
          {errors.confirm && <p className="mt-1 text-xs text-red-500">{errors.confirm}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" isLoading={submitting}>
            <KeyRound size={16} className="mr-1.5" />
            รีเซ็ตรหัสผ่าน
          </Button>
        </div>
      </form>
    </Modal>
  );
};
