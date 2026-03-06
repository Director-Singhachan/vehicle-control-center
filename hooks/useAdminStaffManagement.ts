import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  adminStaffService,
  type StaffProfile,
  type CreateStaffInput,
  type UpdateStaffInput,
  type StaffListFilters,
} from '../services/adminStaffService';
import { serviceStaffService } from '../services/serviceStaffService';
import type { Database } from '../types/database';
import { useToast } from './useToast';
import type { AppRole } from '../types/database';
import { excelExport } from '../utils/excelExport';

type ServiceStaffRow = Database['public']['Tables']['service_staff']['Row'];

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

  // ─── Create modal server error (e.g. duplicate employee_code) ────────────
  const [createError, setCreateError] = useState<string | null>(null);

  // ─── Unique branch list (derived from loaded staff) ─────────────────────
  const branches = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => { if (s.branch) set.add(s.branch); });
    return Array.from(set).sort();
  }, [staffList]);

  // ─── Client-side filtered list (respect branch filter) ───────────────────
  const filteredStaffList = useMemo(() => {
    if (!filters.branch) return staffList;
    return staffList.filter((s) => s.branch === filters.branch);
  }, [staffList, filters.branch]);

  // ─── รายชื่อ service_staff ที่ยังไม่มีบัญชี (สำหรับผูกบัญชีกับรายชื่อเดิม) ─
  const [unlinkedServiceStaff, setUnlinkedServiceStaff] = useState<ServiceStaffRow[]>([]);

  // ─── Fetch staff list ────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      // ดึงรายการพนักงานจากฝั่ง server ตามตัวกรองอื่น ๆ
      // แต่ไม่ล็อค branch ที่ server เพื่อให้ dropdown สาขาแสดงครบ
      const data = await adminStaffService.getAll({ ...filters, branch: '' });
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

  // ─── Open create modal + โหลดรายชื่อที่ยังไม่มีบัญชี ─────────────────────
  const openCreate = useCallback(async () => {
    setCreateError(null);
    setModals((m) => ({ ...m, create: true }));
    try {
      const list = await serviceStaffService.getUnlinked();
      setUnlinkedServiceStaff(list);
    } catch {
      setUnlinkedServiceStaff([]);
    }
  }, []);

  // ─── Create staff ────────────────────────────────────────────────────────
  const handleCreate = useCallback(
    async (input: CreateStaffInput) => {
      setSubmitting(true);
      setCreateError(null);
      try {
        const result = await adminStaffService.createUser(input);
        success(
          `สร้างพนักงาน "${input.full_name}" สำเร็จ · รหัส ${result.employee_code} · อีเมล ${result.email}`,
        );
        setModals((m) => ({ ...m, create: false }));
        fetchStaff();
      } catch (err: any) {
        const msg = err.message || 'สร้างบัญชีไม่สำเร็จ';
        setCreateError(msg);
        showError(msg);
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

  // ─── Migrate email (เปลี่ยนจาก @driver.local → @staff.local) ─────────────
  const handleMigrateEmail = useCallback(
    async (userId: string, employeeCode: string) => {
      setSubmitting(true);
      try {
        const result = await adminStaffService.migrateEmail(userId, employeeCode);
        success(`ย้าย Email สำเร็จ · รหัส ${result.employee_code} · อีเมล ${result.email}`);
        setModals((m) => ({ ...m, edit: null }));
        fetchStaff();
      } catch (err: any) {
        showError(err.message || 'ย้าย Email ไม่สำเร็จ');
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

  // ─── Export to Excel ─────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const ROLE_LABEL: Record<AppRole, string> = {
      admin: 'Admin', manager: 'Manager', hr: 'HR', accounting: 'บัญชี',
      warehouse: 'คลัง', driver: 'คนขับ', service_staff: 'บริการ',
      sales: 'ขาย', inspector: 'ตรวจสอบ', executive: 'ผู้บริหาร', user: 'User',
    };
    excelExport.exportToExcel(
      filteredStaffList,
      [
        { key: 'employee_code', label: 'รหัสพนักงาน', width: 16 },
        { key: 'full_name', label: 'ชื่อ-นามสกุล', width: 28 },
        { key: 'role', label: 'บทบาท', width: 16, format: (v: AppRole) => ROLE_LABEL[v] ?? v },
        { key: 'branch', label: 'สาขา', width: 18, format: (v: string | null) => v || '-' },
        { key: 'department', label: 'แผนก', width: 18, format: (v: string | null) => v || '-' },
        { key: 'position', label: 'ตำแหน่ง', width: 22, format: (v: string | null) => v || '-' },
        { key: 'phone', label: 'เบอร์โทร', width: 16, format: (v: string | null) => v || '-' },
        { key: 'email', label: 'Email', width: 30 },
        { key: 'is_banned', label: 'สถานะ', width: 12, format: (v: boolean) => v ? 'ปิดบัญชี' : 'ใช้งาน' },
        { key: 'created_at', label: 'วันที่สร้าง', width: 20, format: excelExport.formatDate },
      ],
      `รายชื่อพนักงาน_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.xlsx`,
      'พนักงาน',
    );
  }, [filteredStaffList]);

  return {
    // list
    staffList: filteredStaffList,
    listLoading,
    listError,
    filters,
    setFilters,
    branches,
    unlinkedServiceStaff,
    refetch: fetchStaff,

    // modals
    modals,
    openCreate,
    openEdit: (staff: StaffProfile) => setModals((m) => ({ ...m, edit: staff })),
    openResetPassword: (staff: StaffProfile) => setModals((m) => ({ ...m, resetPassword: staff })),
    openConfirmToggle: (staff: StaffProfile) => setModals((m) => ({ ...m, confirmToggle: staff })),
    closeCreate: () => { setCreateError(null); setModals((m) => ({ ...m, create: false })); },
    closeEdit: () => setModals((m) => ({ ...m, edit: null })),
    closeResetPassword: () => setModals((m) => ({ ...m, resetPassword: null })),
    closeConfirmToggle: () => setModals((m) => ({ ...m, confirmToggle: null })),

    // operations
    submitting,
    createError,
    handleCreate,
    handleEdit,
    handleMigrateEmail,
    handleResetPassword,
    handleToggleStatus,
    handleExport,

    // toast
    toasts,
    dismissToast,
  };
}
