import React, { useEffect, useMemo, useState } from 'react';
import type { AppRole } from '../../types/database';
import type { AccessLevel, FeatureKey } from '../../types/featureAccess';
import { APP_ROLES } from '../../services/featureAccessService';
import { ACCESS_LEVEL_OPTIONS } from '../../hooks/useRoleFeatureAccessSettings';

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
  'tab.rls_test': 'ทดสอบ RLS',
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
      'tab.rls_test',
      'tab.settings',
      'tab.role_feature_access',
      'tab.db_explorer',
    ],
  },
];

interface RoleFeatureAccessMatrixSectionProps {
  selectedRole: AppRole;
  onRoleChange: (role: AppRole) => void;
  levels: Record<FeatureKey, AccessLevel>;
  /** บันทึกแถวเดียวแบบ optimistic (ผู้เรียกจัดการ toast / refetch) */
  onLevelCommit: (key: FeatureKey, level: AccessLevel) => Promise<void>;
  loading: boolean;
}

export const RoleFeatureAccessMatrixSection: React.FC<RoleFeatureAccessMatrixSectionProps> = ({
  selectedRole,
  onRoleChange,
  levels,
  onLevelCommit,
  loading,
}) => {
  const [activeGroupId, setActiveGroupId] = useState<string>(FEATURE_GROUPS[0]?.id ?? '');

  useEffect(() => {
    setActiveGroupId(FEATURE_GROUPS[0]?.id ?? '');
  }, [selectedRole]);

  const activeGroup = useMemo(
    () => FEATURE_GROUPS.find((g) => g.id === activeGroupId) ?? FEATURE_GROUPS[0],
    [activeGroupId],
  );

  return (
    <div className="space-y-5">
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
            {activeGroup?.keys.length} ฟีเจอร์ในหมวดนี้ — เลือกหมวดอื่นด้านบนได้โดยไม่ต้องเลื่อนหน้า
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(activeGroup?.keys ?? []).map((key) => (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 bg-white dark:bg-charcoal-900/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {FEATURE_LABELS[key] ?? key}
                </p>
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
          ))}
        </div>
      </div>
    </div>
  );
};
