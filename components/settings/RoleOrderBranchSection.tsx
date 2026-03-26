import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import type { AppRole } from '../../types/database';
import { ORDER_SCOPE_BRANCH_CODES, getBranchLabel } from '../../utils/branchLabels';
import {
  deleteRoleOrderBranchScope,
  fetchScopesForRole,
  upsertRoleOrderBranchScope,
  type OrderBranchVisibility,
  type RoleOrderBranchScopeRow,
} from '../../services/roleOrderBranchService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../../hooks/useToast';

interface RoleOrderBranchSectionProps {
  selectedRole: AppRole;
  onAfterSave?: () => void;
}

const VISIBILITY_OPTIONS: { value: OrderBranchVisibility; label: string; hint: string }[] = [
  {
    value: 'all_branches',
    label: 'เห็นออเดอร์ทุกสาขา',
    hint: 'สร้าง/ดูได้ทั้ง HQ, SD, Asia (ไม่จำกัดตามโปรไฟล์)',
  },
  {
    value: 'own_branch_only',
    label: 'เห็นเฉพาะสาขาในโปรไฟล์',
    hint: 'เฉพาะคนที่โปรไฟล์เป็นสาขานี้ — จำกัดเฉพาะสาขาที่ตรงกับที่ตั้งไว้ด้านบน',
  },
];

function visibilityLabel(v: OrderBranchVisibility): string {
  return VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/**
 * ตั้งค่า (บทบาท + รหัสสาขาในโปรไฟล์ HQ/SD/Asia) → มองเห็นออเดอร์ทุกสาขาหรือเฉพาะสาขาโปรไฟล์
 */
export const RoleOrderBranchSection: React.FC<RoleOrderBranchSectionProps> = ({
  selectedRole,
  onAfterSave,
}) => {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scopeRows, setScopeRows] = useState<RoleOrderBranchScopeRow[]>([]);
  const [scopeByProfileBranch, setScopeByProfileBranch] = useState<
    Partial<Record<string, OrderBranchVisibility>>
  >({});
  const [profileBranchKey, setProfileBranchKey] = useState<string>('HQ');
  const [visibilityChoice, setVisibilityChoice] = useState<OrderBranchVisibility>('own_branch_only');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchScopesForRole(selectedRole);
      setScopeRows(rows);
      const next: Partial<Record<string, OrderBranchVisibility>> = {};
      for (const r of rows) {
        next[r.profile_branch] = r.visibility;
      }
      setScopeByProfileBranch(next);
    } catch (e) {
      error(e instanceof Error ? e.message : 'โหลดการตั้งค่าไม่สำเร็จ');
      setScopeRows([]);
      setScopeByProfileBranch({});
    } finally {
      setLoading(false);
    }
  }, [selectedRole, error]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const v = scopeByProfileBranch[profileBranchKey];
    setVisibilityChoice(v ?? 'own_branch_only');
  }, [profileBranchKey, scopeByProfileBranch]);

  const overviewRows = useMemo(() => {
    return ORDER_SCOPE_BRANCH_CODES.map((code) => {
      const row = scopeRows.find((r) => r.profile_branch === code);
      return { code, row };
    });
  }, [scopeRows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertRoleOrderBranchScope(selectedRole, profileBranchKey, visibilityChoice);
      success(
        `บันทึกแล้ว: บทบาท ${selectedRole} + โปรไฟล์สาขา ${profileBranchKey} → ${visibilityLabel(visibilityChoice)}`,
      );
      await load();
      onAfterSave?.();
    } catch (e) {
      error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleClearPair = async () => {
    if (!scopeByProfileBranch[profileBranchKey]) {
      success('คู่นี้ยังไม่มีการกำหนดพิเศษ');
      return;
    }
    setSaving(true);
    try {
      await deleteRoleOrderBranchScope(selectedRole, profileBranchKey);
      success(`ล้างการตั้งค่าสำหรับโปรไฟล์สาขา ${profileBranchKey} แล้ว — ใช้กฎเดิมในระบบ`);
      await load();
      onAfterSave?.();
    } catch (e) {
      error(e instanceof Error ? e.message : 'ล้างไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 mt-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-charcoal-900/60">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-enterprise-100 dark:bg-enterprise-900/40 text-enterprise-600 dark:text-enterprise-400">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="space-y-3 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            ออเดอร์: ขอบเขตตามบทบาท + สาขาในโปรไฟล์
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            เลือกบทบาทจากแถบด้านบน จากนั้นเลือกว่า “พนักงานที่โปรไฟล์เป็นสาขาไหน” จะมองเห็นออเดอร์แบบไหน — ไม่ต้องติ๊กหลายสาขา
            แยกตั้งได้ว่า Sale ที่โปรไฟล์ HQ เห็นทั้งระบบ แต่ Sale ที่โปรไฟล์ SD เห็นแค่ SD
          </p>
          <ol className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl space-y-1 list-decimal list-inside leading-relaxed">
            <li>เลือกรหัสสาขาในโปรไฟล์ (HQ / SD / Asia) ที่ต้องการกำหนด</li>
            <li>เลือกโหมดมองเห็น แล้วกดบันทึก — หรือกดล้างคู่นี้เพื่อกลับไปใช้กฎเดิมของระบบ</li>
          </ol>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          กำลังโหลด…
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 overflow-x-auto">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 px-3 pt-3 pb-2">
              สถานะที่บันทึกในฐานข้อมูล (บทบาท {selectedRole})
            </p>
            <table className="w-full text-xs text-left border-t border-slate-200 dark:border-slate-700">
              <thead className="bg-slate-100/90 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">โปรไฟล์สาขา</th>
                  <th className="px-3 py-2 font-semibold">การมองเห็นออเดอร์</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300 divide-y divide-slate-200 dark:divide-slate-700">
                {overviewRows.map(({ code, row }) => (
                  <tr
                    key={code}
                    className={
                      profileBranchKey === code
                        ? 'bg-enterprise-50/70 dark:bg-enterprise-950/25'
                        : 'bg-white/50 dark:bg-charcoal-900/20'
                    }
                  >
                    <td className="px-3 py-2">
                      <span className="font-mono">{code}</span>
                      <span className="text-slate-500 dark:text-slate-500"> — {getBranchLabel(code)}</span>
                    </td>
                    <td className="px-3 py-2">
                      {row ? (
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {visibilityLabel(row.visibility)}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 italic">
                          ยังไม่กำหนด — ใช้กฎเดิมในระบบ
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {row ? formatUpdatedAt(row.updated_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scopeRows.length === 0 && (
              <p className="px-3 pb-3 pt-1 text-[11px] text-amber-800 dark:text-amber-200/90 leading-relaxed">
                ยังไม่พบแถวใดในฐานข้อมูลสำหรับบทบาทนี้ หากเคยตั้งค่าในระบบเก่าก่อนอัปเดต schema การจำกัดสาขาอาจอยู่ในตารางเดิมที่ถูกแทนที่ — ต้องบันทึกใหม่ในแบบฟอร์มด้านล่าง
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="role-order-profile-branch"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                สาขาในโปรไฟล์ (รหัสที่ตั้งในบัญชีพนักงาน)
              </label>
              <select
                id="role-order-profile-branch"
                value={profileBranchKey}
                onChange={(e) => setProfileBranchKey(e.target.value)}
                disabled={saving}
                className="w-full max-w-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:ring-enterprise-500 focus:border-enterprise-500"
              >
                {ORDER_SCOPE_BRANCH_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} — {getBranchLabel(code)}
                  </option>
                ))}
              </select>
              {scopeByProfileBranch[profileBranchKey] == null && (
                <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
                  ยังไม่มีแถวในฐานข้อมูลสำหรับคู่นี้ → ใช้กฎเดิมจนกว่าจะบันทึก
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                มองเห็นออเดอร์
              </legend>
              {VISIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex gap-2 cursor-pointer items-start text-sm text-slate-800 dark:text-slate-200"
                >
                  <input
                    type="radio"
                    name="order-branch-visibility"
                    checked={visibilityChoice === opt.value}
                    onChange={() => setVisibilityChoice(opt.value)}
                    disabled={saving}
                    className="mt-1 w-4 h-4 border-slate-300 text-enterprise-600 focus:ring-enterprise-500 dark:border-slate-600 dark:bg-charcoal-800"
                  />
                  <span>
                    <span className="font-medium">{opt.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-5">
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : `บันทึก (${selectedRole} + โปรไฟล์ ${profileBranchKey})`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleClearPair()}
              disabled={saving}
            >
              ล้างการตั้งค่าคู่นี้
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};
