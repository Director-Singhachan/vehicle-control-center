import { useCallback, useEffect, useState } from 'react';
import type { AppRole } from '../types/database';
import type { AccessLevel, FeatureKey } from '../types/featureAccess';
import { builtInMatrixForRole, matrixForAdminEditor } from '../types/featureAccess';
import {
  clearRoleFeatureOverrides,
  fetchRoleFeatureMatrix,
  upsertSingleRoleFeature,
} from '../services/featureAccessService';

export const ACCESS_LEVEL_OPTIONS: AccessLevel[] = ['none', 'view', 'edit', 'manage'];

export function useRoleFeatureAccessSettings() {
  const [selectedRole, setSelectedRole] = useState<AppRole>('manager');
  const [levels, setLevels] = useState<Record<FeatureKey, AccessLevel>>(
    () => builtInMatrixForRole('manager'),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRole = useCallback(async (role: AppRole) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchRoleFeatureMatrix(role);
      setLevels(matrixForAdminEditor(role, rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      setLevels(builtInMatrixForRole(role));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRole(selectedRole);
  }, [selectedRole, loadRole]);

  /** Optimistic: อัปเดต UI ก่อน แล้วค่อย upsert แถวเดียว — ล้มเหลวจะ rollback */
  const commitLevel = useCallback(
    async (key: FeatureKey, level: AccessLevel) => {
      let rollback: AccessLevel | undefined;
      setLevels((p) => {
        rollback = p[key];
        return { ...p, [key]: level };
      });
      try {
        await upsertSingleRoleFeature(selectedRole, key, level);
        const rows = await fetchRoleFeatureMatrix(selectedRole);
        setLevels(matrixForAdminEditor(selectedRole, rows));
      } catch (e) {
        if (rollback !== undefined) {
          setLevels((p) => ({ ...p, [key]: rollback }));
        }
        throw e;
      }
    },
    [selectedRole],
  );

  /** รีเซ็ต role นี้ให้กลับไปใช้ค่า built-in (ลบแถวในตาราง) */
  const resetToBuiltIn = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await clearRoleFeatureOverrides(selectedRole);
      setLevels(builtInMatrixForRole(selectedRole));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'รีเซ็ตไม่สำเร็จ');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [selectedRole]);

  return {
    selectedRole,
    setSelectedRole,
    levels,
    commitLevel,
    resetToBuiltIn,
    loading,
    saving,
    error,
    reload: () => loadRole(selectedRole),
  };
}
