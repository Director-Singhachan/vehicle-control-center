import React from 'react';
import { UserPlus, ShieldAlert, Upload, Mail } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ToastContainer } from '../components/ui/Toast';
import { StaffListSection } from '../components/staff/StaffListSection';
import { StaffCreateModal } from '../components/staff/StaffCreateModal';
import { StaffEditModal } from '../components/staff/StaffEditModal';
import { StaffResetPasswordModal } from '../components/staff/StaffResetPasswordModal';
import { StaffImportModal } from '../components/staff/StaffImportModal';
import { StaffBulkEmailModal } from '../components/staff/StaffBulkEmailModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAdminStaffManagement } from '../hooks/useAdminStaffManagement';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

export const AdminStaffManagementView: React.FC = () => {
  const { can } = useFeatureAccess();
  const canView = can('tab.admin_staff', 'view');
  const canEdit = can('tab.admin_staff', 'edit');
  const canManage = can('tab.admin_staff', 'manage');

  const {
    staffList,
    staffDirectoryFull,
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
    openImport,
    openBulkEmail,
    closeCreate,
    closeEdit,
    closeResetPassword,
    closeConfirmToggle,
    closeConfirmDelete,
    closeImport,
    closeBulkEmail,
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
    notifySuccess,
    notifyError,
    notifyWarning,
  } = useAdminStaffManagement();

  if (!canView) {
    return (
      <PageLayout title="จัดการบัญชีพนักงาน">
        <Card className="p-10 text-center">
          <ShieldAlert size={40} className="mx-auto mb-4 text-red-400" />
          <p className="text-slate-600 dark:text-slate-400">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="จัดการบัญชีพนักงาน"
      subtitle={`พนักงานทั้งหมด ${staffList.length} คน`}
      actions={
        canEdit ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openImport}>
              <Upload size={16} className="mr-1.5" />
              นำเข้าพนักงาน (Excel)
            </Button>
            <Button variant="outline" onClick={openBulkEmail}>
              <Mail size={16} className="mr-1.5" />
              เปลี่ยนอีเมล
            </Button>
            <Button onClick={openCreate}>
              <UserPlus size={16} className="mr-1.5" />
              สร้างพนักงานใหม่
            </Button>
          </div>
        ) : undefined
      }
    >
      <StaffListSection
        staffList={staffList}
        loading={listLoading}
        error={listError}
        filters={filters}
        branches={branches}
        onFilterChange={setFilters}
        onRefetch={refetch}
        onExport={handleExport}
        onEdit={canEdit ? openEdit : undefined}
        onResetPassword={canEdit ? openResetPassword : undefined}
        onToggleStatus={canEdit ? openConfirmToggle : undefined}
        onDeleteUser={canManage ? openConfirmDelete : undefined}
      />

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

      <StaffBulkEmailModal
        isOpen={modals.bulkEmail}
        onClose={closeBulkEmail}
        existingStaff={staffDirectoryFull}
        onSuccessRefetch={refetch}
        onBatchComplete={(r) => {
          if (r.total === 0) {
            notifyWarning('กรุณากรอกอย่างน้อยหนึ่งแถว (รหัสพนักงาน + อีเมลใหม่)');
            return;
          }
          if (r.errors.length > 0 && r.success === 0 && r.failed === 0) {
            notifyError(r.errors[0], 12000);
            return;
          }
          if (r.failed > 0 && r.success === 0) {
            notifyError(
              `เปลี่ยนอีเมลไม่สำเร็จ ${r.failed} รายการ${r.errors[0] ? ` — ${r.errors[0]}` : ''}`,
              12000,
            );
            return;
          }
          if (r.failed > 0) {
            notifyWarning(
              `เปลี่ยนอีเมลสำเร็จ ${r.success} รายการ · ล้มเหลว ${r.failed}${r.errors[0] ? ` — ${r.errors[0]}` : ''}`,
              12000,
            );
            return;
          }
          if (r.success > 0) {
            notifySuccess(`เปลี่ยนอีเมลสำเร็จ ${r.success} รายการ`);
            return;
          }
          if (r.skipped > 0 && r.skipped === r.total) {
            notifyWarning('ทุกแถวเป็นอีเมลเดิมอยู่แล้ว — ไม่มีการบันทึก');
          }
        }}
      />

      <StaffImportModal
        isOpen={modals.import}
        existingStaff={staffDirectoryFull}
        onClose={closeImport}
        onSuccess={refetch}
        onImportBatchComplete={({ success: ok, failed, errors, total }) => {
          if (total === 0) {
            notifyWarning('ไม่มีรายการที่ต้องบันทึก (ทุกแถวถูกข้าม)');
            return;
          }
          if (failed > 0 && ok === 0) {
            notifyError(
              `นำเข้าไม่สำเร็จทั้งหมด ${failed} รายการ${errors[0] ? ` — ${errors[0]}` : ''}`,
              12000,
            );
            return;
          }
          if (failed > 0) {
            notifyWarning(
              `นำเข้าสำเร็จ ${ok} รายการ · ล้มเหลว ${failed} รายการ${errors[0] ? ` — ${errors[0]}` : ''}`,
              12000,
            );
            return;
          }
          notifySuccess(`นำเข้าสำเร็จ ${ok} รายการ`);
        }}
      />

      <ConfirmDialog
        isOpen={!!modals.confirmToggle}
        title={
          (modals.confirmToggle as { is_banned?: boolean })?.is_banned
            ? `เปิดบัญชี "${modals.confirmToggle?.full_name}"?`
            : `ปิดบัญชี "${modals.confirmToggle?.full_name}"?`
        }
        message={
          (modals.confirmToggle as { is_banned?: boolean })?.is_banned
            ? 'พนักงานจะสามารถ login เข้าระบบได้อีกครั้ง'
            : 'พนักงานจะไม่สามารถ login เข้าระบบได้จนกว่าจะเปิดบัญชีอีกครั้ง'
        }
        confirmText={(modals.confirmToggle as { is_banned?: boolean })?.is_banned ? 'เปิดบัญชี' : 'ปิดบัญชี'}
        variant={(modals.confirmToggle as { is_banned?: boolean })?.is_banned ? 'info' : 'danger'}
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
