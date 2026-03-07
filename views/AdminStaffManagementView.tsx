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
    openConfirmDelete,
    closeCreate,
    closeEdit,
    closeResetPassword,
    closeConfirmToggle,
    closeConfirmDelete,
    submitting,
    createError,
    handleCreate,
    handleEdit,
    handleMigrateEmail,
    handleRelinkServiceStaff,
    handleResetPassword,
    handleToggleStatus,
    handleDeleteUser,
    handleExport,
    allServiceStaff,
    linkedServiceStaff,
    relinkLoading,
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
        onExport={handleExport}
        onEdit={openEdit}
        onResetPassword={openResetPassword}
        onToggleStatus={openConfirmToggle}
        onDeleteUser={isAdmin || isHR ? openConfirmDelete : undefined}
      />

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <StaffCreateModal
        isOpen={modals.create}
        branches={branches}
        unlinkedServiceStaff={unlinkedServiceStaff}
        submitting={submitting}
        serverError={createError}
        onSubmit={handleCreate}
        onClose={closeCreate}
      />

      <StaffEditModal
        staff={modals.edit}
        branches={branches}
        submitting={submitting}
        allServiceStaff={allServiceStaff}
        linkedServiceStaff={linkedServiceStaff}
        relinkLoading={relinkLoading}
        onSubmit={handleEdit}
        onMigrateEmail={handleMigrateEmail}
        onRelink={handleRelinkServiceStaff}
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
        confirmText={(modals.confirmToggle as any)?.is_banned ? 'เปิดบัญชี' : 'ปิดบัญชี'}
        variant={(modals.confirmToggle as any)?.is_banned ? 'info' : 'danger'}
        onConfirm={() => modals.confirmToggle && handleToggleStatus(modals.confirmToggle)}
        onCancel={closeConfirmToggle}
      />

      <ConfirmDialog
        isOpen={!!modals.confirmDelete}
        title={`ลบบัญชี "${modals.confirmDelete?.full_name}"?`}
        message={`การดำเนินการนี้ไม่สามารถย้อนกลับได้\nบัญชีและข้อมูล login จะถูกลบออกจากระบบถาวร\nประวัติทริปและข้อมูลการทำงานยังคงอยู่`}
        confirmText="ลบบัญชีถาวร"
        variant="danger"
        onConfirm={() => modals.confirmDelete && handleDeleteUser(modals.confirmDelete)}
        onCancel={closeConfirmDelete}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PageLayout>
  );
};
