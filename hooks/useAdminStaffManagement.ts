import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  adminStaffService,
  type StaffProfile,
  type CreateStaffInput,
  type UpdateStaffInput,
  type StaffListFilters,
} from '../services/adminStaffService';
import { useToast } from './useToast';
import type { AppRole } from '../types/database';

interface ModalState {
  create: boolean;
  edit: StaffProfile | null;
  resetPassword: StaffProfile | null;
  confirmToggle: StaffProfile | null;
}

export function useAdminStaffManagement() {
  const { toasts, success, error: showError, dismissToast } = useToast();

  // ─── List state ──────────────────────────────────────────────────────────
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StaffListFilters>({ search: '', role: '', branch: '' });

  // ─── Modal state ─────────────────────────────────────────────────────────
  const [modals, setModals] = useState<ModalState>({
    create: false,
    edit: null,
    resetPassword: null,
    confirmToggle: null,
  });

  // ─── Operation loading ───────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ─── Unique branch list (derived from loaded staff) ─────────────────────
  const branches = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => { if (s.branch) set.add(s.branch); });
    return Array.from(set).sort();
  }, [staffList]);

  // ─── Fetch staff list ────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await adminStaffService.getAll(filters);
      setStaffList(data);
    } catch (err: any) {
      setListError(err.message || 'โหลดข้อมูลพนักงานไม่สำเร็จ');
    } finally {
      setListLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // ─── Open create modal ──────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setModals((m) => ({ ...m, create: true }));
  }, []);

  // ─── Create staff ────────────────────────────────────────────────────────
  const handleCreate = useCallback(
    async (input: CreateStaffInput) => {
      setSubmitting(true);
      try {
        const result = await adminStaffService.createUser(input);
        success(
          `สร้างพนักงาน "${input.full_name}" สำเร็จ · รหัส ${result.employee_code} · อีเมล ${result.email}`,
        );
        setModals((m) => ({ ...m, create: false }));
        fetchStaff();
      } catch (err: any) {
        showError(err.message || 'สร้างบัญชีไม่สำเร็จ');
      } finally {
        setSubmitting(false);
      }
    },
    [fetchStaff, success, showError],
  );

  // ─── Edit staff ──────────────────────────────────────────────────────────
  const handleEdit = useCallback(
    async (userId: string, input: UpdateStaffInput) => {
      setSubmitting(true);
      try {
        await adminStaffService.updateProfile(userId, input);
        success('อัปเดตข้อมูลสำเร็จ');
        setModals((m) => ({ ...m, edit: null }));
        fetchStaff();
      } catch (err: any) {
        showError(err.message || 'อัปเดตข้อมูลไม่สำเร็จ');
      } finally {
        setSubmitting(false);
      }
    },
    [fetchStaff, success, showError],
  );

  // ─── Reset password ──────────────────────────────────────────────────────
  const handleResetPassword = useCallback(
    async (userId: string, newPassword: string) => {
      setSubmitting(true);
      try {
        await adminStaffService.resetPassword(userId, newPassword);
        success('รีเซ็ตรหัสผ่านสำเร็จ');
        setModals((m) => ({ ...m, resetPassword: null }));
      } catch (err: any) {
        showError(err.message || 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
      } finally {
        setSubmitting(false);
      }
    },
    [success, showError],
  );

  // ─── Toggle status ───────────────────────────────────────────────────────
  const handleToggleStatus = useCallback(
    async (staff: StaffProfile) => {
      const isBanned = (staff as any).is_banned;
      setSubmitting(true);
      try {
        await adminStaffService.toggleStatus(staff.id, !isBanned);
        success(!isBanned ? `ปิดบัญชี "${staff.full_name}" แล้ว` : `เปิดบัญชี "${staff.full_name}" แล้ว`);
        setModals((m) => ({ ...m, confirmToggle: null }));
        fetchStaff();
      } catch (err: any) {
        showError(err.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      } finally {
        setSubmitting(false);
      }
    },
    [fetchStaff, success, showError],
  );

  return {
    // list
    staffList,
    listLoading,
    listError,
    filters,
    setFilters,
    branches,
    refetch: fetchStaff,

    // modals
    modals,
    openCreate,
    openEdit: (staff: StaffProfile) => setModals((m) => ({ ...m, edit: staff })),
    openResetPassword: (staff: StaffProfile) => setModals((m) => ({ ...m, resetPassword: staff })),
    openConfirmToggle: (staff: StaffProfile) => setModals((m) => ({ ...m, confirmToggle: staff })),
    closeCreate: () => setModals((m) => ({ ...m, create: false })),
    closeEdit: () => setModals((m) => ({ ...m, edit: null })),
    closeResetPassword: () => setModals((m) => ({ ...m, resetPassword: null })),
    closeConfirmToggle: () => setModals((m) => ({ ...m, confirmToggle: null })),

    // operations
    submitting,
    handleCreate,
    handleEdit,
    handleResetPassword,
    handleToggleStatus,

    // toast
    toasts,
    dismissToast,
  };
}
