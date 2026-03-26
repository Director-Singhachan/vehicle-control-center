import React, { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ToastContainer } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { RoleFeatureAccessMatrixSection } from '../components/settings/RoleFeatureAccessMatrixSection';
import { useRoleFeatureAccessSettings } from '../hooks/useRoleFeatureAccessSettings';
import { useAuth } from '../hooks/useAuth';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { useToast } from '../hooks/useToast';
import { builtInMatrixForRole } from '../types/featureAccess';

export const RoleFeatureAccessSettingsView: React.FC = () => {
  const { isAdmin } = useAuth();
  const { refetch: refetchFeatureAccess } = useFeatureAccess();
  const { toasts, success, error, dismissToast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const {
    selectedRole,
    setSelectedRole,
    levels,
    commitLevel,
    resetToBuiltIn,
    saveAll,
    loading,
    saving,
    error: loadError,
    reload,
  } = useRoleFeatureAccessSettings();

  const builtInLevels = useMemo(() => builtInMatrixForRole(selectedRole), [selectedRole]);

  const handleLevelCommit = async (key: Parameters<typeof commitLevel>[0], level: Parameters<typeof commitLevel>[1]) => {
    try {
      await commitLevel(key, level);
      await refetchFeatureAccess();
    } catch (e) {
      error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ — ค่าถูกย้อนกลับแล้ว');
    }
  };

  const handleReset = async () => {
    try {
      await resetToBuiltIn();
      success('รีเซ็ตเป็นค่าเริ่มต้นในระบบแล้ว');
      await refetchFeatureAccess();
      setResetOpen(false);
    } catch (e) {
      error(e instanceof Error ? e.message : 'รีเซ็ตไม่สำเร็จ');
    }
  };

  const handleSaveAll = async () => {
    try {
      await saveAll();
      success('บันทึกทุกฟีเจอร์สำเร็จ');
      await refetchFeatureAccess();
    } catch (e) {
      error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  if (!isAdmin) {
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
      subtitle="สรุปตามฝ่ายด้านล่างช่วยไล่ตรวจเร็ว — กรอง «เฉพาะที่ต่างจากค่าเริ่มต้น» ได้ — ระดับ: ไม่มี / ดู / แก้ไข / จัดการเต็ม"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void reload()} disabled={loading || saving}>
            โหลดใหม่
          </Button>
          <Button variant="outline" onClick={() => setResetOpen(true)} disabled={loading || saving}>
            รีเซ็ต role นี้
          </Button>
          <Button variant="outline" onClick={() => void handleSaveAll()} disabled={loading || saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกทั้งแผง'}
          </Button>
        </div>
      }
    >
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
