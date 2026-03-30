import React, { useEffect, useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { AppRole } from '../../types/database';
import type { AccessLevel, FeatureKey } from '../../types/featureAccess';
import { accessLevelAtLeast, FEATURE_KEYS } from '../../types/featureAccess';
import { APP_ROLES } from '../../services/featureAccessService';
import { ACCESS_LEVEL_OPTIONS } from '../../hooks/useRoleFeatureAccessSettings';
import { Card } from '../ui/Card';
import {
  FEATURE_GROUPS,
  FEATURE_LABELS,
  levelLabel,
  levelSelectClasses,
  levelShort,
  ROLE_LABELS_TH,
} from './roleFeatureAccessMatrixConfig';

type ListFilter = 'all' | 'diff' | 'none_only';

interface RoleFeatureAccessMatrixSectionProps {
  selectedRole: AppRole;
  onRoleChange: (role: AppRole) => void;
  levels: Record<FeatureKey, AccessLevel>;
  /** ค่าเริ่มต้นในโปรแกรม (เปรียบเทียบ override ใน DB) */
  builtInLevels: Record<FeatureKey, AccessLevel>;
  /** บันทึกแถวเดียวแบบ optimistic (ผู้เรียกจัดการ toast / refetch) */
  onLevelCommit: (key: FeatureKey, level: AccessLevel) => Promise<void>;
  loading: boolean;
  readOnly?: boolean;
}

export const RoleFeatureAccessMatrixSection: React.FC<RoleFeatureAccessMatrixSectionProps> = ({
  selectedRole,
  onRoleChange,
  levels,
  builtInLevels,
  onLevelCommit,
  loading,
  readOnly = false,
}) => {
  const [activeGroupId, setActiveGroupId] = useState<string>(FEATURE_GROUPS[0]?.id ?? '');
  const [listFilter, setListFilter] = useState<ListFilter>('all');

  useEffect(() => {
    setActiveGroupId(FEATURE_GROUPS[0]?.id ?? '');
    setListFilter('all');
  }, [selectedRole]);

  const activeGroup = useMemo(
    () => FEATURE_GROUPS.find((g) => g.id === activeGroupId) ?? FEATURE_GROUPS[0],
    [activeGroupId],
  );

  const groupSummaries = useMemo(
    () =>
      FEATURE_GROUPS.map((g) => {
        let open = 0;
        let none = 0;
        let diff = 0;
        for (const k of g.keys) {
          const l = levels[k];
          if (accessLevelAtLeast(l, 'view')) open += 1;
          if (l === 'none') none += 1;
          if (l !== builtInLevels[k]) diff += 1;
        }
        return { ...g, open, none, diff, total: g.keys.length };
      }),
    [levels, builtInLevels],
  );

  const totals = useMemo(() => {
    let open = 0;
    let none = 0;
    let diff = 0;
    for (const k of FEATURE_KEYS) {
      const l = levels[k];
      if (accessLevelAtLeast(l, 'view')) open += 1;
      if (l === 'none') none += 1;
      if (l !== builtInLevels[k]) diff += 1;
    }
    return { open, none, diff, total: FEATURE_KEYS.length };
  }, [levels, builtInLevels]);

  const visibleKeys = useMemo(() => {
    const keys = activeGroup?.keys ?? [];
    if (listFilter === 'diff') return keys.filter((k) => levels[k] !== builtInLevels[k]);
    if (listFilter === 'none_only') return keys.filter((k) => levels[k] === 'none');
    return keys;
  }, [activeGroup, levels, builtInLevels, listFilter]);

  const openPct = totals.total ? Math.round((totals.open / totals.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 flex-wrap">
                สรุปสิทธิ์ของบทบาทนี้
                <span className="font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({selectedRole})
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                ไม่มี → ดู → แก้ไข → เต็ม · ระดับสูงรวมสิทธิ์ระดับต่ำ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-charcoal-900/40 px-3 py-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">ฟีเจอร์ทั้งหมด</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{totals.total}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-enterprise-100 dark:border-enterprise-900/50 bg-enterprise-50/90 dark:bg-enterprise-900/25 px-3 py-2 text-sm">
                <span className="text-enterprise-900 dark:text-enterprise-100">เปิดใช้ (ดูขึ้นไป)</span>
                <span className="font-semibold tabular-nums text-enterprise-900 dark:text-enterprise-100">
                  {totals.open}
                </span>
                <span className="text-enterprise-600 dark:text-enterprise-500/90 tabular-nums text-sm">
                  ({openPct}%)
                </span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-charcoal-900/40 px-3 py-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">ปิดสิ้นเชิง</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{totals.none}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/30 px-3 py-2 text-sm">
                <span className="text-amber-900 dark:text-amber-200">ต่างจากค่าเริ่มต้น</span>
                <span className="font-semibold tabular-nums text-amber-900 dark:text-amber-200">{totals.diff}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-charcoal-800 overflow-hidden max-w-md">
              <div
                className="h-full rounded-full bg-enterprise-500 dark:bg-enterprise-600 transition-[width] duration-300"
                style={{ width: `${openPct}%` }}
              />
            </div>
          </div>
        </div>

        <details className="mt-4 group border border-slate-200/80 dark:border-slate-700/80 rounded-lg bg-slate-50/50 dark:bg-charcoal-900/30">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white [&::-webkit-details-marker]:hidden">
            <HelpCircle size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="font-medium">อธิบายระดับสิทธิ์ / เมทริกซ์กับ RLS</span>
          </summary>
          <div className="px-3 pb-3 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
            <ul className="space-y-1.5 list-none">
              <li>
                <span className="font-medium text-slate-800 dark:text-slate-200">ไม่มี</span> — ปิดเมนูและเข้าหน้าไม่ได้
              </li>
              <li>
                <span className="font-medium text-slate-800 dark:text-slate-200">ดู</span> — อ่านข้อมูล ส่วนใหญ่ไม่มีปุ่มแก้ไข
              </li>
              <li>
                <span className="font-medium text-slate-800 dark:text-slate-200">แก้ไข</span> — สร้าง/แก้ตามปกติ
              </li>
              <li>
                <span className="font-medium text-slate-800 dark:text-slate-200">เต็ม</span> — รวมแก้ไข และงานเสี่ยงในบางหน้า (เช่น ลบ, ยกเลิกทริป)
              </li>
            </ul>
            <p>
              มีแถวในฐานข้อมูลอย่างน้อยหนึ่งรายการต่อบทบาท → ฟีเจอร์ที่ไม่ตั้งในตารางจะปิดในเมนู (โปรไฟล์/ตั้งค่ามีกฎพิเศษ)
              ลบแถวของบทบาทนั้นหมด → กลับค่าเริ่มต้นของโปรแกรม
            </p>
            <p>
              หน้านี้ไม่แก้ RLS — ถ้าปุ่มกดได้แต่ API ปฏิเสธ ให้ตรวจสิทธิ์บนตารางนั้น
            </p>
          </div>
        </details>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="flex flex-col gap-1.5 min-w-[240px] lg:max-w-sm">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">บทบาท (Role)</span>
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value as AppRole)}
            disabled={loading}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-charcoal-900/50 px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:border-enterprise-500 transition-all"
          >
            {APP_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS_TH[r]} ({r})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[220px]">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">แสดงรายการในหมวด</span>
          <select
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value as ListFilter)}
            disabled={loading}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-charcoal-900/50 px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:border-enterprise-500 transition-all"
          >
            <option value="all">ทั้งหมด</option>
            <option value="diff">ต่างจากค่าเริ่มต้น</option>
            <option value="none_only">เฉพาะปิด (ไม่มี)</option>
          </select>
        </label>
        {loading && (
          <span className="text-sm text-slate-600 dark:text-slate-400 lg:pb-2">กำลังโหลด...</span>
        )}
      </div>

      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-slate-50/95 dark:bg-charcoal-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
          role="tablist"
          aria-label="เลือกฝ่ายเพื่อกำหนดสิทธิ์"
        >
          {groupSummaries.map((row) => {
            const isActive = row.id === activeGroup.id;
            const Icon = row.icon;
            const pct = row.total ? Math.round((row.open / row.total) * 100) : 0;
            return (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                id={`feature-group-tab-${row.id}`}
                disabled={loading}
                onClick={() => setActiveGroupId(row.id)}
                className={`shrink-0 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enterprise-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-charcoal-950 min-w-[148px] sm:min-w-[168px] ${
                  isActive
                    ? 'border-enterprise-500 bg-enterprise-500 text-white shadow-md dark:bg-enterprise-600 dark:border-enterprise-500'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-charcoal-900 text-slate-800 dark:text-slate-100 hover:border-enterprise-500/50 dark:hover:border-enterprise-600'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-charcoal-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug">
                    {row.title}
                  </span>
                  <span
                    className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums leading-normal ${
                      isActive ? 'text-white/90' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>
                      เปิด {row.open}/{row.total}
                    </span>
                    <span className="opacity-70">·</span>
                    <span>{pct}%</span>
                    {row.diff > 0 && (
                      <>
                        <span className="opacity-70">·</span>
                        <span className={isActive ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}>
                          ปรับ {row.diff}
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        aria-labelledby={`feature-group-tab-${activeGroup.id}`}
        aria-label={`ฟีเจอร์ในหมวด ${activeGroup.title}`}
        className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-charcoal-900/60 shadow-sm"
      >
        {activeGroup && (
          <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-enterprise-50/70 dark:bg-enterprise-900/20 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              {(() => {
                const HeaderIcon = activeGroup.icon;
                return (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-enterprise-100 dark:bg-enterprise-900/40 text-enterprise-600 dark:text-enterprise-500">
                    <HeaderIcon size={20} strokeWidth={2} />
                  </span>
                );
              })()}
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{activeGroup.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {visibleKeys.length} / {activeGroup.keys.length}
                  {listFilter !== 'all' && ` · ${listFilter === 'diff' ? 'ต่างจากเริ่มต้น' : 'ปิดเท่านั้น'}`}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {visibleKeys.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-600 dark:text-slate-400">
              ไม่มีรายการตามตัวกรอง — ลองเปลี่ยนตัวกรองหรือหมวด
            </div>
          ) : (
            visibleKeys.map((key) => {
              const differs = levels[key] !== builtInLevels[key];
              const cur = levels[key];
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 lg:flex-row lg:items-center px-4 py-4 bg-white/50 dark:bg-charcoal-900/20"
                >
                  <div className="flex-1 min-w-0 lg:max-w-[min(100%,28rem)]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                        {FEATURE_LABELS[key] ?? key}
                      </p>
                      {differs && (
                        <span className="text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/80 dark:border-amber-900/50">
                          ต่างจากค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-1">
                      {key}
                    </p>
                  </div>
                  <div className="w-full lg:w-auto lg:min-w-[340px]">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 lg:hidden">
                      ระดับสิทธิ์ ({levelLabel(cur)})
                    </p>
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/90 dark:bg-charcoal-800/60 p-1 gap-0.5">
                      {ACCESS_LEVEL_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={loading || readOnly}
                          onClick={() => {
                            if (opt === cur) return;
                            void onLevelCommit(key, opt);
                          }}
                          title={levelLabel(opt)}
                          className={levelSelectClasses(cur === opt, opt)}
                        >
                          {levelShort(opt)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
