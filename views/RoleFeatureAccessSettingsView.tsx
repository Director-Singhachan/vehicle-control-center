import React, { useMemo, useState } from 'react';
import { RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ToastContainer } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { RoleFeatureAccessMatrixSection } from '../components/settings/RoleFeatureAccessMatrixSection';
import { useRoleFeatureAccessSettings } from '../hooks/useRoleFeatureAccessSettings';
import { useAuth } from '../hooks/useAuth';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { useOrderBranchScope } from '../hooks/useOrderBranchScope';
import { RoleOrderBranchSection } from '../components/settings/RoleOrderBranchSection';
import { useToast } from '../hooks/useToast';
import { builtInMatrixForRole } from '../types/featureAccess';

export const RoleFeatureAccessSettingsView: React.FC = () => {
  const { profile } = useAuth();
  const {
    can,
    loading: featureAccessLoading,
    refetch: refetchFeatureAccess,
  } = useFeatureAccess();
  const { refetch: refetchOrderBranchScope } = useOrderBranchScope();
  const { toasts, success, error, dismissToast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const {
    selectedRole,
    setSelectedRole,
    levels,
    commitLevel,
    resetToBuiltIn,
    loading,
    saving,
    error: loadError,
    reload,
  } = useRoleFeatureAccessSettings();

  const builtInLevels = useMemo(() => builtInMatrixForRole(selectedRole), [selectedRole]);
  const canViewRoleFeatureAccess = can('tab.role_feature_access', 'view');
  const canEditRoleFeatureAccess = can('tab.role_feature_access', 'edit');

  const handleLevelCommit = async (key: Parameters<typeof commitLevel>[0], level: Parameters<typeof commitLevel>[1]) => {
    if (!canEditRoleFeatureAccess) {
      return;
    }
    try {
      await commitLevel(key, level);
      if (profile?.role === selectedRole) {
        await refetchFeatureAccess();
      }
    } catch (e) {
      error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ — ค่าถูกย้อนกลับแล้ว');
    }
  };

  const handleReset = async () => {
    if (!canEditRoleFeatureAccess) {
      return;
    }
    try {
      await resetToBuiltIn();
      success('รีเซ็ตเป็นค่าเริ่มต้นในระบบแล้ว');
      if (profile?.role === selectedRole) {
        await refetchFeatureAccess();
      }
      setResetOpen(false);
    } catch (e) {
      error(e instanceof Error ? e.message : 'รีเซ็ตไม่สำเร็จ');
    }
  };

  if (featureAccessLoading) {
    return (
      <PageLayout title="สิทธิ์ตามฟีเจอร์">
        <Card className="p-10 text-center">
          <p className="text-slate-600 dark:text-slate-400">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</p>
        </Card>
      </PageLayout>
    );
  }

  if (!canViewRoleFeatureAccess) {
    return (
      <PageLayout title="สิทธิ์ตามฟีเจอร์">
        <Card className="p-10 text-center">
          <ShieldAlert size={40} className="mx-auto mb-4 text-red-400" />
          <p className="text-slate-600 dark:text-slate-400">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น</p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="กำหนดสิทธิ์ตามฟีเจอร์"
      subtitle="ควบคุมเมนูและปุ่มในแอป — แต่ละฟีเจอร์บันทึกทันที; การเขียนข้อมูลจริงยังผ่าน RLS ของฐานข้อมูล"
      actions={
        <div className="flex flex-col items-stretch sm:flex-row sm:flex-wrap sm:items-center gap-2 min-w-0 max-w-full">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] sm:min-h-0"
            onClick={() => void reload()}
            disabled={loading || saving}
            title="ดึงค่าล่าสุดจากเซิร์ฟเวอร์สำหรับบทบาทที่เลือก"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin shrink-0' : 'shrink-0'} />
            <span>โหลดข้อมูลใหม่</span>
          </Button>
          {canEditRoleFeatureAccess && (
            <Button
              type="button"
              variant="outline"
              size="md"
              className="inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] sm:min-h-0 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
              onClick={() => setResetOpen(true)}
              disabled={loading || saving}
              title="ล้างการตั้งค่าในฐานข้อมูลของบทบาทนี้ แล้วกลับไปค่าเริ่มต้นของโปรแกรม"
            >
              <RotateCcw size={18} className="shrink-0" />
              <span>รีเซ็ตบทบาทนี้</span>
            </Button>
          )}
        </div>
      }
    >
      {!canEditRoleFeatureAccess && (
        <Card className="mb-4 p-4 border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/40">
          <p className="text-sm text-amber-800 dark:text-amber-200">โหมดดูอย่างเดียว — ไม่สามารถแก้ค่าได้</p>
        </Card>
      )}
      {loadError && (
        <Card className="mb-4 p-4 border-red-200 dark:border-red-900 bg-red-50/80 dark:bg-red-950/40">
          <p className="text-sm text-red-800 dark:text-red-200">{loadError}</p>
        </Card>
      )}
      <RoleFeatureAccessMatrixSection
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        levels={levels}
        builtInLevels={builtInLevels}
        onLevelCommit={handleLevelCommit}
        loading={loading}
        readOnly={!canEditRoleFeatureAccess}
      />
      <RoleOrderBranchSection
        selectedRole={selectedRole}
        readOnly={!canEditRoleFeatureAccess}
        onAfterSave={() => {
          if (profile?.role === selectedRole) {
            void refetchOrderBranchScope();
          }
        }}
      />
      <ConfirmDialog
        isOpen={resetOpen}
        title="รีเซ็ตสิทธิ์ของบทบาทนี้?"
        message={`จะลบการตั้งค่าในฐานข้อมูลสำหรับบทบาท "${selectedRole}" และกลับไปใช้ค่าเริ่มต้นในโปรแกรม`}
        confirmText="รีเซ็ต"
        variant="danger"
        onConfirm={() => void handleReset()}
        onCancel={() => setResetOpen(false)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PageLayout>
  );
};
