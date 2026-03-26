import React, { useEffect, useMemo, useState } from 'react';
import type { AppRole } from '../../types/database';
import type { AccessLevel, FeatureKey } from '../../types/featureAccess';
import { accessLevelAtLeast, FEATURE_KEYS } from '../../types/featureAccess';
import { APP_ROLES } from '../../services/featureAccessService';
import { ACCESS_LEVEL_OPTIONS } from '../../hooks/useRoleFeatureAccessSettings';
import { Card } from '../ui/Card';

const FEATURE_LABELS: Partial<Record<FeatureKey, string>> = {
  'tab.reports': 'รายงาน (ศูนย์กลาง)',
  'report.pnl_trip': 'P&L รายเที่ยว',
  'report.pnl_vehicle': 'P&L รายคัน',
  'report.pnl_fleet': 'P&L ทั้งกองเรือ',
  'tab.create_order': 'สร้างออเดอร์',
  'tab.confirm_orders': 'ยืนยันและแบ่งส่ง',
  'tab.track_orders': 'ติดตามออเดอร์',
  'tab.sales_trips': 'ออกใบแจ้งหนี้',
  'tab.products': 'จัดการสินค้า / ราคา',
  'tab.product_pricing': 'กำหนดราคาตามลูกค้า',
  'tab.customer_tiers': 'ระดับลูกค้า',
  'tab.customers': 'จัดการลูกค้า',
  'tab.cleanup_test_orders': 'จัดการออเดอร์ (ทดสอบ)',
  'tab.excel_import': 'นำเข้าข้อมูล (Excel)',
  'tab.stock_dashboard': 'Stock Dashboard',
  'tab.warehouses': 'จัดการคลัง',
  'tab.inventory_receipts': 'ประวัติรับสินค้า',
  'tab.dashboard': 'แดชบอร์ดฝ่ายขนส่ง',
  'tab.vehicles': 'ยานพาหนะ',
  'tab.maintenance': 'ซ่อมบำรุง',
  'tab.triplogs': 'บันทึกการใช้งานรถ',
  'tab.fuellogs': 'บันทึกการเติมน้ำมัน',
  'tab.approvals': 'ภาพรวมการอนุมัติ',
  'tab.daily_summary': 'สรุปการใช้รถรายวัน',
  'tab.delivery_trips': 'ทริปส่งสินค้า',
  'tab.packing_simulation': 'จำลองจัดเรียง',
  'tab.pending_orders': 'ออเดอร์รอจัดส่ง',
  'tab.pending_sales': 'รายการขายค้าง',
  'tab.admin_staff': 'บัญชีพนักงาน',
  'tab.service_staff': 'ประวัติการปฏิบัติงาน',
  'tab.commission': 'ค่าคอมมิชชั่น',
  'tab.commission_rates': 'อัตราค่าคอมมิชชั่น',
  'tab.profile': 'โปรไฟล์',
  'tab.settings': 'ตั้งค่าแจ้งเตือน',
  'tab.role_feature_access': 'หน้านี้ — สิทธิ์ตามฟีเจอร์',
  'tab.db_explorer': 'สำรวจฐานข้อมูล (DB)',
};

function levelLabel(l: AccessLevel): string {
  switch (l) {
    case 'none':
      return 'ไม่มี';
    case 'view':
      return 'ดูอย่างเดียว';
    case 'edit':
      return 'แก้ไข';
    case 'manage':
      return 'จัดการเต็ม';
    default:
      return l;
  }
}

interface FeatureGroup {
  id: string;
  title: string;
  keys: FeatureKey[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'finance_reports',
    title: 'การเงิน / รายงาน',
    keys: ['tab.reports', 'report.pnl_trip', 'report.pnl_vehicle', 'report.pnl_fleet'],
  },
  {
    id: 'sales',
    title: 'ฝ่ายขาย',
    keys: [
      'tab.create_order',
      'tab.confirm_orders',
      'tab.track_orders',
      'tab.sales_trips',
      'tab.products',
      'tab.product_pricing',
      'tab.customer_tiers',
      'tab.customers',
      'tab.cleanup_test_orders',
      'tab.pending_sales',
    ],
  },
  {
    id: 'warehouse',
    title: 'คลังสินค้า',
    keys: ['tab.stock_dashboard', 'tab.warehouses', 'tab.inventory_receipts'],
  },
  {
    id: 'logistics',
    title: 'ฝ่ายขนส่ง',
    keys: [
      'tab.dashboard',
      'tab.vehicles',
      'tab.maintenance',
      'tab.triplogs',
      'tab.fuellogs',
      'tab.approvals',
      'tab.daily_summary',
      'tab.delivery_trips',
      'tab.packing_simulation',
      'tab.pending_orders',
    ],
  },
  {
    id: 'hr',
    title: 'จัดการบุคคล / HR',
    keys: ['tab.admin_staff', 'tab.service_staff', 'tab.commission', 'tab.commission_rates'],
  },
  {
    id: 'system',
    title: 'ระบบ',
    keys: [
      'tab.excel_import',
      'tab.profile',
      'tab.settings',
      'tab.role_feature_access',
      'tab.db_explorer',
    ],
  },
];

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
}

export const RoleFeatureAccessMatrixSection: React.FC<RoleFeatureAccessMatrixSectionProps> = ({
  selectedRole,
  onRoleChange,
  levels,
  builtInLevels,
  onLevelCommit,
  loading,
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

  return (
    <div className="space-y-5">
      <Card className="p-4 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-charcoal-900/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">สรุปตามฝ่าย (คลิกการ์ดเพื่อไปแก้หมวดนั้น)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              บทบาท: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{selectedRole}</span> — ทั้งหมด {totals.total}{' '}
              ฟีเจอร์ — เข้าถึงได้ (ดูขึ้นไป){' '}
              <span className="font-semibold text-enterprise-600 dark:text-enterprise-400">{totals.open}</span> — ปิดทั้งหมด{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{totals.none}</span> — ต่างจากค่าเริ่มต้นในโปรแกรม{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400">{totals.diff}</span> รายการ
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed border-t border-slate-200/80 dark:border-slate-700/80 pt-2">
              เมื่อบันทึกสิทธิ์ลงระบบอย่างน้อยหนึ่งรายการต่อบทบาทนี้ ผู้ใช้จะเห็นเฉพาะฟีเจอร์ที่เปิดในรายการนี้เท่านั้น — ช่องที่ไม่ได้บันทึกจะไม่แสดงเมนู
              (โปรไฟล์ / ตั้งค่า ใช้ค่าเริ่มต้นของบทบาทจนกว่าจะตั้งในนี้) หากลบแถวของบทบาทนั้นหมดจากฐานข้อมูลจะกลับไปใช้สิทธิ์เริ่มต้นของโปรแกรมทั้งบทบาท
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {groupSummaries.map((row) => {
            const active = row.id === activeGroup.id;
            return (
              <button
                key={row.id}
                type="button"
                disabled={loading}
                onClick={() => setActiveGroupId(row.id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enterprise-500 dark:focus-visible:ring-offset-charcoal-950 focus-visible:ring-offset-2 ${
                  active
                    ? 'border-enterprise-400 bg-enterprise-50 dark:bg-enterprise-950/50 dark:border-enterprise-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-charcoal-900/40 hover:border-enterprise-200 dark:hover:border-enterprise-800'
                }`}
              >
                <div className="font-semibold text-slate-800 dark:text-slate-100">{row.title}</div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    เปิด {row.open}/{row.total}
                  </span>
                  <span>ปิด {row.none}</span>
                  {row.diff > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">ต่างจากค่าเริ่มต้น {row.diff}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">บทบาท (Role)</span>
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value as AppRole)}
            disabled={loading}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-charcoal-900 px-3 py-2 text-slate-900 dark:text-white min-w-[200px]"
          >
            {APP_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm lg:hidden w-full min-w-0">
          <span className="text-slate-600 dark:text-slate-400">ฝ่าย / หมวดหมู่</span>
          <select
            value={activeGroupId}
            onChange={(e) => setActiveGroupId(e.target.value)}
            disabled={loading}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-charcoal-900 px-3 py-2 text-slate-900 dark:text-white w-full max-w-md"
          >
            {FEATURE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({g.keys.length})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm w-full sm:w-auto min-w-[220px]">
          <span className="text-slate-600 dark:text-slate-400">แสดงรายการในหมวด</span>
          <select
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value as ListFilter)}
            disabled={loading}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-charcoal-900 px-3 py-2 text-slate-900 dark:text-white"
          >
            <option value="all">ทั้งหมดในหมวดนี้</option>
            <option value="diff">เฉพาะที่ต่างจากค่าเริ่มต้นในโปรแกรม</option>
            <option value="none_only">เฉพาะที่สิทธิ์ = ไม่มี</option>
          </select>
        </label>
        {loading && (
          <span className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลด...</span>
        )}
      </div>

      <div className="hidden lg:block sticky top-0 z-10 -mx-1 px-1 py-2 bg-slate-50/95 dark:bg-charcoal-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="เลือกฝ่ายเพื่อกำหนดสิทธิ์"
        >
          {FEATURE_GROUPS.map((group) => {
            const isActive = group.id === activeGroup.id;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                id={`feature-group-tab-${group.id}`}
                disabled={loading}
                onClick={() => setActiveGroupId(group.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enterprise-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-charcoal-950 ${
                  isActive
                    ? 'bg-enterprise-500 border-enterprise-600 text-white shadow-sm dark:bg-enterprise-600 dark:border-enterprise-500'
                    : 'bg-white dark:bg-charcoal-900 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-enterprise-300 dark:hover:border-enterprise-700'
                }`}
              >
                <span className="whitespace-nowrap">{group.title}</span>
                <span
                  className={`ml-1.5 tabular-nums opacity-90 ${isActive ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  ({group.keys.length})
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
        className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-charcoal-900/30 shadow-sm"
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-enterprise-50/60 dark:bg-enterprise-950/30">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{activeGroup?.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            แสดง {visibleKeys.length} / {activeGroup?.keys.length ?? 0} ในหมวดนี้
            {listFilter !== 'all' && ` (กรอง: ${listFilter === 'diff' ? 'ต่างจากค่าเริ่มต้น' : 'เฉพาะปิด'})`}
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {visibleKeys.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              ไม่มีรายการในโหมดกรองนี้ — ลองเปลี่ยน &quot;แสดงรายการในหมวด&quot; หรือเลือกหมวดอื่น
            </div>
          ) : (
            visibleKeys.map((key) => {
              const differs = levels[key] !== builtInLevels[key];
              return (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 bg-white dark:bg-charcoal-900/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {FEATURE_LABELS[key] ?? key}
                      </p>
                      {differs && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-100/90 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                          ต่างจากค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{key}</p>
                  </div>
                  <select
                    value={levels[key]}
                    onChange={(e) => {
                      void onLevelCommit(key, e.target.value as AccessLevel);
                    }}
                    disabled={loading}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-charcoal-900 px-3 py-2 text-slate-900 dark:text-white text-sm min-w-[220px] w-full sm:w-auto"
                  >
                    {ACCESS_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {levelLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
