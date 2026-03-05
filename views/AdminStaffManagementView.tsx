import React from 'react';
import { UserPlus, ShieldAlert } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ToastContainer } from '../components/ui/Toast';
import { StaffListSection } from '../components/staff/StaffListSection';
import { StaffCreateModal } from '../components/staff/StaffCreateModal';
import { StaffEditModal } from '../components/staff/StaffEditModal';
import { StaffResetPasswordModal } from '../components/staff/StaffResetPasswordModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAdminStaffManagement } from '../hooks/useAdminStaffManagement';
import { useAuth } from '../hooks';

export const AdminStaffManagementView: React.FC = () => {
  const { isAdmin, isHR } = useAuth();
  const {
    staffList,
    listLoading,
    listError,
    filters,
    setFilters,
    branches,
    unlinkedServiceStaff,
    refetch,
    modals,
    openCreate,
    openEdit,
    openResetPassword,
    openConfirmToggle,
    closeCreate,
    closeEdit,
    closeResetPassword,
    closeConfirmToggle,
    submitting,
    handleCreate,
    handleEdit,
    handleResetPassword,
    handleToggleStatus,
    toasts,
    dismissToast,
  } = useAdminStaffManagement();

  // ─── Access guard ─────────────────────────────────────────────────────────
  if (!isAdmin && !isHR) {
    return (
      <PageLayout title="จัดการบัญชีพนักงาน">
        <Card className="p-10 text-center">
          <ShieldAlert size={40} className="mx-auto mb-4 text-red-400" />
          <p className="text-slate-600 dark:text-slate-400">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (ต้องเป็น Admin หรือ HR)
          </p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="จัดการบัญชีพนักงาน"
      subtitle={`พนักงานทั้งหมด ${staffList.length} คน`}
      actions={
        <Button onClick={openCreate}>
          <UserPlus size={16} className="mr-1.5" />
          สร้างพนักงานใหม่
        </Button>
      }
    >
      {/* ── Staff list ─────────────────────────────────────────────── */}
      <StaffListSection
        staffList={staffList}
        loading={listLoading}
        error={listError}
        filters={filters}
        branches={branches}
        onFilterChange={setFilters}
        onRefetch={refetch}
        onEdit={openEdit}
        onResetPassword={openResetPassword}
        onToggleStatus={openConfirmToggle}
      />

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <StaffCreateModal
        isOpen={modals.create}
        branches={branches}
        unlinkedServiceStaff={unlinkedServiceStaff}
        submitting={submitting}
        onSubmit={handleCreate}
        onClose={closeCreate}
      />

      <StaffEditModal
        staff={modals.edit}
        branches={branches}
        submitting={submitting}
        onSubmit={handleEdit}
        onClose={closeEdit}
      />

      <StaffResetPasswordModal
        staff={modals.resetPassword}
        submitting={submitting}
        onSubmit={handleResetPassword}
        onClose={closeResetPassword}
      />

      <ConfirmDialog
        isOpen={!!modals.confirmToggle}
        title={
          (modals.confirmToggle as any)?.is_banned
            ? `เปิดบัญชี "${modals.confirmToggle?.full_name}"?`
            : `ปิดบัญชี "${modals.confirmToggle?.full_name}"?`
        }
        message={
          (modals.confirmToggle as any)?.is_banned
            ? 'พนักงานจะสามารถ login เข้าระบบได้อีกครั้ง'
            : 'พนักงานจะไม่สามารถ login เข้าระบบได้จนกว่าจะเปิดบัญชีอีกครั้ง'
        }
        confirmLabel={(modals.confirmToggle as any)?.is_banned ? 'เปิดบัญชี' : 'ปิดบัญชี'}
        variant={(modals.confirmToggle as any)?.is_banned ? 'primary' : 'danger'}
        onConfirm={() => modals.confirmToggle && handleToggleStatus(modals.confirmToggle)}
        onCancel={closeConfirmToggle}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PageLayout>
  );
};
