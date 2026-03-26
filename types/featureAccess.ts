import type { AppRole } from './database';

/** ระดับสิทธิ์ต่อฟีเจอร์ — เรียงจากต่ำไปสูง */
export type AccessLevel = 'none' | 'view' | 'edit' | 'manage';

export const ACCESS_LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  manage: 3,
};

export const PRIVILEGED_ROLES: AppRole[] = ['admin', 'hr'];

export const FEATURE_KEYS = [
  'tab.reports',
  'report.pnl_trip',
  'report.pnl_vehicle',
  'report.pnl_fleet',
  'tab.create_order',
  'tab.confirm_orders',
  'tab.track_orders',
  'tab.sales_trips',
  'tab.products',
  'tab.product_pricing',
  'tab.customer_tiers',
  'tab.customers',
  'tab.cleanup_test_orders',
  'tab.excel_import',
  'tab.stock_dashboard',
  'tab.warehouses',
  'tab.inventory_receipts',
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
  'tab.pending_sales',
  'tab.admin_staff',
  'tab.service_staff',
  'tab.commission',
  'tab.commission_rates',
  'tab.profile',
  'tab.rls_test',
  'tab.settings',
  'tab.role_feature_access',
  'tab.db_explorer',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** แมปแท็บหลัก (activeTab) → ฟีเจอร์หลักสำหรับ guard เมนู/หน้า */
export const TAB_TO_PRIMARY_FEATURE: Record<string, FeatureKey> = {
  reports: 'tab.reports',
  'create-order': 'tab.create_order',
  'confirm-orders': 'tab.confirm_orders',
  'track-orders': 'tab.track_orders',
  'sales-trips': 'tab.sales_trips',
  products: 'tab.products',
  'product-pricing': 'tab.product_pricing',
  'customer-tiers': 'tab.customer_tiers',
  customers: 'tab.customers',
  'cleanup-test-orders': 'tab.cleanup_test_orders',
  'excel-import': 'tab.excel_import',
  'stock-dashboard': 'tab.stock_dashboard',
  warehouses: 'tab.warehouses',
  'inventory-receipts': 'tab.inventory_receipts',
  dashboard: 'tab.dashboard',
  vehicles: 'tab.vehicles',
  maintenance: 'tab.maintenance',
  triplogs: 'tab.triplogs',
  fuellogs: 'tab.fuellogs',
  approvals: 'tab.approvals',
  'daily-summary': 'tab.daily_summary',
  'delivery-trips': 'tab.delivery_trips',
  'packing-simulation': 'tab.packing_simulation',
  'pending-orders': 'tab.pending_orders',
  'pending-sales': 'tab.pending_sales',
  'admin-staff': 'tab.admin_staff',
  'service-staff': 'tab.service_staff',
  commission: 'tab.commission',
  'commission-rates': 'tab.commission_rates',
  profile: 'tab.profile',
  'rls-test': 'tab.rls_test',
  settings: 'tab.settings',
  'role-feature-access': 'tab.role_feature_access',
  'db-explorer': 'tab.db_explorer',
};

export function accessLevelAtLeast(userLevel: AccessLevel, required: AccessLevel): boolean {
  return ACCESS_LEVEL_ORDER[userLevel] >= ACCESS_LEVEL_ORDER[required];
}

export function isPrivilegedRole(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return PRIVILEGED_ROLES.includes(role);
}

function fillAll(level: AccessLevel): Record<FeatureKey, AccessLevel> {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, level])) as Record<FeatureKey, AccessLevel>;
}

/** ค่า built-in เมื่อไม่มีแถวใน DB (หรือก่อน migrate) — คงพฤติกรรมเดิมโดยประมาณ */
const BUILT_IN: Partial<Record<AppRole, Partial<Record<FeatureKey, AccessLevel>>>> = {
  user: {
    ...fillAll('none'),
    'tab.dashboard': 'view',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
  driver: {
    ...fillAll('none'),
    'tab.triplogs': 'manage',
    'tab.fuellogs': 'manage',
    'tab.maintenance': 'manage',
    'tab.packing_simulation': 'manage',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
  service_staff: {
    ...fillAll('none'),
    'tab.packing_simulation': 'manage',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
  sales: {
    ...fillAll('none'),
    'tab.create_order': 'manage',
    'tab.confirm_orders': 'manage',
    'tab.track_orders': 'manage',
    'tab.sales_trips': 'manage',
    'tab.products': 'manage',
    'tab.product_pricing': 'manage',
    'tab.customer_tiers': 'manage',
    'tab.customers': 'manage',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
  inspector: {
    ...fillAll('none'),
    'tab.dashboard': 'view',
    'tab.vehicles': 'view',
    'tab.maintenance': 'manage',
    'tab.triplogs': 'manage',
    'tab.fuellogs': 'manage',
    'tab.approvals': 'manage',
    'tab.daily_summary': 'view',
    'tab.delivery_trips': 'manage',
    'tab.packing_simulation': 'manage',
    'tab.pending_orders': 'view',
    'tab.reports': 'view',
    'report.pnl_trip': 'none',
    'report.pnl_vehicle': 'none',
    'report.pnl_fleet': 'none',
    'tab.stock_dashboard': 'view',
    'tab.confirm_orders': 'manage',
    'tab.warehouses': 'none',
    'tab.inventory_receipts': 'none',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
  manager: {
    ...fillAll('manage'),
    'tab.admin_staff': 'none',
    'tab.service_staff': 'none',
    'tab.commission': 'none',
    'tab.commission_rates': 'none',
    'tab.rls_test': 'view',
    'tab.role_feature_access': 'none',
    'report.pnl_fleet': 'none',
  },
  executive: {
    ...fillAll('manage'),
    'tab.admin_staff': 'none',
    'tab.service_staff': 'none',
    'tab.commission': 'none',
    'tab.commission_rates': 'none',
    'tab.rls_test': 'none',
    'tab.role_feature_access': 'none',
    'report.pnl_trip': 'none',
    'report.pnl_vehicle': 'none',
    'report.pnl_fleet': 'manage',
  },
  accounting: {
    ...fillAll('none'),
    'tab.reports': 'view',
    'tab.dashboard': 'view',
    'tab.stock_dashboard': 'manage',
    'tab.confirm_orders': 'manage',
    'tab.warehouses': 'view',
    'tab.inventory_receipts': 'view',
    'tab.delivery_trips': 'view',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
  warehouse: {
    ...fillAll('none'),
    'tab.dashboard': 'view',
    'tab.stock_dashboard': 'manage',
    'tab.confirm_orders': 'manage',
    'tab.warehouses': 'manage',
    'tab.inventory_receipts': 'manage',
    'tab.delivery_trips': 'manage',
    'tab.packing_simulation': 'manage',
    'tab.triplogs': 'view',
    'tab.reports': 'view',
    'report.pnl_trip': 'manage',
    'report.pnl_vehicle': 'none',
    'report.pnl_fleet': 'none',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
};

export function builtInLevel(role: AppRole | null, feature: FeatureKey): AccessLevel {
  if (!role) return 'none';
  if (isPrivilegedRole(role)) return 'manage';
  const partial = BUILT_IN[role];
  if (partial && partial[feature] !== undefined) return partial[feature]!;
  return 'none';
}

/** ดึงระดับสิทธิ์ P&L จาก feature keys (ใช้ร่วมกับ usePermissions) */
export function builtInPnlFlags(role: AppRole | null): {
  canViewTripPnl: boolean;
  canViewVehiclePnl: boolean;
  canViewFleetPnl: boolean;
} {
  const trip = builtInLevel(role, 'report.pnl_trip');
  const veh = builtInLevel(role, 'report.pnl_vehicle');
  const fleet = builtInLevel(role, 'report.pnl_fleet');
  return {
    canViewTripPnl: accessLevelAtLeast(trip, 'view'),
    canViewVehiclePnl: accessLevelAtLeast(veh, 'view'),
    canViewFleetPnl: accessLevelAtLeast(fleet, 'view'),
  };
}

/** merge DB row ทับ built-in */
export function resolveAccessLevel(
  role: AppRole | null,
  feature: FeatureKey,
  dbLevel: AccessLevel | undefined,
): AccessLevel {
  if (dbLevel !== undefined) return dbLevel;
  return builtInLevel(role, feature);
}

/** ระดับ built-in ทุกฟีเจอร์สำหรับ role (ใช้หน้าตั้งค่า) */
export function builtInMatrixForRole(role: AppRole | null): Record<FeatureKey, AccessLevel> {
  return Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, builtInLevel(role, k)]),
  ) as Record<FeatureKey, AccessLevel>;
}
