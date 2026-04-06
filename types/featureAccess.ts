import type { AppRole } from './database';

/** ระดับสิทธิ์ต่อฟีเจอร์ — เรียงจากต่ำไปสูง */
export type AccessLevel = 'none' | 'view' | 'edit' | 'manage';

export const ACCESS_LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  manage: 3,
};

export const PRIVILEGED_ROLES: AppRole[] = ['admin', 'hr', 'dev'];

export const FEATURE_KEYS = [
  'tab.reports',
  'report.pnl_trip',
  'report.pnl_vehicle',
  'report.pnl_fleet',
  /** แดชบอร์ด / แท็บรายงานผู้บริหาร (Fleet P&L สรุปภาพรวม) */
  'report.pnl_executive',
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
  'tab.purchase_receipts',
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
  'tab.settings',
  'tab.role_feature_access',
  'tab.db_explorer',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * เมื่อ role มีแถวใน role_feature_access อย่างน้อยหนึ่งแถว — ฟีเจอร์ที่ไม่มีใน DB จะเป็น none (ไม่ fallback built-in เต็มรายการ)
 * ยกเว้นกลุ่มนี้ที่ยังใช้ built-in เพื่อให้เข้าโปรไฟล์ / ตั้งค่าพื้นฐานได้ (ยังตั้งเป็น none ใน matrix ได้ถ้าต้องการปิดจริง ๆ)
 */
/** ฟีเจอร์ที่เพิ่มทีหลัง: ถ้า matrix จาก DB ครบแต่ยังไม่มีแถว key นี้ ให้ fallback built-in (กันเมนูหายจนกว่าจะ seed/backfill) */
export const FEATURE_MATRIX_SURVIVAL_KEYS: readonly FeatureKey[] = [
  'tab.profile',
  'tab.settings',
  'tab.purchase_receipts',
  /** กันผู้บริหาร/บทบาทอื่นหลุดเมนูรายงานเมื่อ seed role_feature_access ไม่ครบ */
  'tab.reports',
  /** Fleet P&L + แดชบอร์ดผู้บริหารใช้ชุดข้อมูลเดียวกัน — fallback built-in ถ้ายังไม่มีแถวใน DB */
  'report.pnl_fleet',
  /** แท็บรายงานผู้บริหาร — fallback built-in เมื่อ seed matrix ยังไม่มีคอลัมน์นี้ */
  'report.pnl_executive',
];

export interface ResolveAccessLevelOptions {
  /** true เมื่อโหลด matrix แล้วและ role นี้มีอย่างน้อยหนึ่งแถวใน DB */
  roleHasDbCustomization?: boolean;
}

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
  'purchase-receipts': 'tab.purchase_receipts',
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
  settings: 'tab.settings',
  'role-feature-access': 'tab.role_feature_access',
  'db-explorer': 'tab.db_explorer',
};

/**
 * ลำดับแท็บสำหรับหาปลายทางเมื่อแท็บปัจจุบันไม่มีสิทธิ์ view — ใช้ร่วมทั้งแอป (สิทธิ์จริงมาจาก matrix เท่านั้น)
 */
const NAV_FALLBACK_PRIORITY: string[] = [
  'dashboard',
  'stock-dashboard',
  'create-order',
  'confirm-orders',
  'track-orders',
  'sales-trips',
  'triplogs',
  'packing-simulation',
  'fuellogs',
  'maintenance',
  'vehicles',
  'pending-orders',
  'delivery-trips',
  'approvals',
  'daily-summary',
  'products',
  'customers',
  'profile',
  'settings',
  'reports',
  'excel-import',
  'warehouses',
  'inventory-receipts',
  'purchase-receipts',
  'cleanup-test-orders',
  'product-pricing',
  'customer-tiers',
  'pending-sales',
  'admin-staff',
  'service-staff',
  'commission',
  'commission-rates',
  'role-feature-access',
  'db-explorer',
];

export const NAV_FALLBACK_TAB_ORDER: readonly string[] = [
  ...NAV_FALLBACK_PRIORITY.filter((t) => t in TAB_TO_PRIMARY_FEATURE),
  ...Object.keys(TAB_TO_PRIMARY_FEATURE).filter((t) => !NAV_FALLBACK_PRIORITY.includes(t)),
];

/** แท็บแรกในลำดับที่ผู้ใช้มีสิทธิ์ view (fallback: สแกนทุกแท็บในแมป) */
export function firstAccessibleTabId(
  can: (feature: FeatureKey, atLeast: AccessLevel) => boolean,
  preferredOrder: readonly string[] = NAV_FALLBACK_TAB_ORDER,
): string | null {
  const hit = (tab: string): string | null => {
    const f = TAB_TO_PRIMARY_FEATURE[tab];
    if (f && can(f, 'view')) return tab;
    return null;
  };
  const seen = new Set<string>();
  for (const tab of preferredOrder) {
    seen.add(tab);
    const h = hit(tab);
    if (h) return h;
  }
  for (const tab of Object.keys(TAB_TO_PRIMARY_FEATURE)) {
    if (seen.has(tab)) continue;
    const h = hit(tab);
    if (h) return h;
  }
  return null;
}

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
    'report.pnl_executive': 'none',
    'tab.stock_dashboard': 'view',
    'tab.confirm_orders': 'manage',
    'tab.warehouses': 'none',
    'tab.inventory_receipts': 'none',
    'tab.purchase_receipts': 'none',
    'tab.profile': 'manage',
    'tab.settings': 'view',
  },
  manager: {
    ...fillAll('manage'),
    'tab.admin_staff': 'none',
    'tab.service_staff': 'none',
    'tab.commission': 'none',
    'tab.commission_rates': 'none',
    'tab.role_feature_access': 'none',
    'report.pnl_fleet': 'none',
    'report.pnl_executive': 'none',
  },
  executive: {
    ...fillAll('manage'),
    'tab.admin_staff': 'none',
    'tab.service_staff': 'none',
    'tab.commission': 'none',
    'tab.commission_rates': 'none',
    'tab.role_feature_access': 'none',
    'report.pnl_trip': 'none',
    'report.pnl_vehicle': 'none',
    'report.pnl_fleet': 'manage',
    'report.pnl_executive': 'manage',
  },
  accounting: {
    ...fillAll('none'),
    'tab.reports': 'view',
    'tab.dashboard': 'view',
    'tab.stock_dashboard': 'manage',
    'tab.confirm_orders': 'manage',
    'tab.warehouses': 'view',
    'tab.inventory_receipts': 'view',
    'tab.purchase_receipts': 'manage',
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
    'tab.purchase_receipts': 'manage',
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
  canViewExecutivePnl: boolean;
} {
  const trip = builtInLevel(role, 'report.pnl_trip');
  const veh = builtInLevel(role, 'report.pnl_vehicle');
  const fleet = builtInLevel(role, 'report.pnl_fleet');
  const exec = builtInLevel(role, 'report.pnl_executive');
  return {
    canViewTripPnl: accessLevelAtLeast(trip, 'view'),
    canViewVehiclePnl: accessLevelAtLeast(veh, 'view'),
    canViewFleetPnl: accessLevelAtLeast(fleet, 'view'),
    canViewExecutivePnl: accessLevelAtLeast(exec, 'view'),
  };
}

/** merge DB row ทับ built-in — ถ้ามี roleHasDbCustomization และไม่ใช่ admin/hr ช่องที่ไม่มีแถวใน DB = none */
export function resolveAccessLevel(
  role: AppRole | null,
  feature: FeatureKey,
  dbLevel: AccessLevel | undefined,
  options?: ResolveAccessLevelOptions,
): AccessLevel {
  if (dbLevel !== undefined) return dbLevel;
  const strict =
    options?.roleHasDbCustomization === true &&
    role != null &&
    !isPrivilegedRole(role);
  if (strict) {
    if (FEATURE_MATRIX_SURVIVAL_KEYS.includes(feature)) {
      return builtInLevel(role, feature);
    }
    return 'none';
  }
  return builtInLevel(role, feature);
}

/** รายงานย่อยใต้เมนูรายงาน — ใช้ร่วม implied access สำหรับ tab.reports */
export const REPORT_SUBFEATURE_KEYS: readonly FeatureKey[] = [
  'report.pnl_trip',
  'report.pnl_vehicle',
  'report.pnl_fleet',
  'report.pnl_executive',
];

/**
 * สิทธิ์เข้าเมนู/หน้า "รายงาน" จริงที่ใช้ในแอป
 * เมื่อมีแถวใน role_feature_access แต่ไม่ได้กำหนด tab.reports — ค่า strict จะทำให้ tab.reports = none
 * (เช่น ฝ่ายขายตั้งแค่ P&L) เมนูรายงานหายทั้งที่ย่อยเปิดอยู่
 * ถ้าไม่มีแถว tab.reports ใน DB ให้ยกระดับตามรายงานย่อยที่ได้สิทธิ์ดูอย่างน้อยหนึ่งรายการ
 * ถ้ามีแถว tab.reports ใน DB แล้ว (รวมระดับ "ไม่มี") ใช้ค่านั้นอย่างเดียว
 */
export function effectiveTabReportsAccess(
  role: AppRole | null,
  dbMap: Partial<Record<FeatureKey, AccessLevel>>,
  roleHasDbCustomization: boolean,
): AccessLevel {
  if (!role) return 'none';

  if (dbMap['tab.reports'] !== undefined) {
    return resolveAccessLevel(role, 'tab.reports', dbMap['tab.reports'], {
      roleHasDbCustomization,
    });
  }

  let best = resolveAccessLevel(role, 'tab.reports', undefined, {
    roleHasDbCustomization,
  });

  if (isPrivilegedRole(role)) return best;

  for (const k of REPORT_SUBFEATURE_KEYS) {
    const pl = resolveAccessLevel(role, k, dbMap[k], { roleHasDbCustomization });
    if (accessLevelAtLeast(pl, 'view') && ACCESS_LEVEL_ORDER[pl] > ACCESS_LEVEL_ORDER[best]) {
      best = pl;
    }
  }
  return best;
}

/** ระดับ built-in ทุกฟีเจอร์สำหรับ role (ใช้หน้าตั้งค่า) */
export function builtInMatrixForRole(role: AppRole | null): Record<FeatureKey, AccessLevel> {
  return Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, builtInLevel(role, k)]),
  ) as Record<FeatureKey, AccessLevel>;
}

/**
 * Matrix เต็มสำหรับหน้าแก้สิทธิ์ — สอดคล้อง resolveAccessLevel แบบ strict:
 * ถ้ามีแถวใน DB อย่างน้อยหนึ่งแถว ฟีเจอร์ที่ไม่มีแถว = none (ยกเว้น profile/settings ใช้ built-in)
 */
export function matrixForAdminEditor(
  role: AppRole,
  rows: { feature_key: string; access_level: AccessLevel }[],
): Record<FeatureKey, AccessLevel> {
  const base = builtInMatrixForRole(role);
  const rowMap: Partial<Record<FeatureKey, AccessLevel>> = {};
  for (const r of rows) {
    const k = r.feature_key as FeatureKey;
    if (FEATURE_KEYS.includes(k)) rowMap[k] = r.access_level;
  }
  const hasDbRows = Object.keys(rowMap).length > 0;
  const next = {} as Record<FeatureKey, AccessLevel>;
  for (const k of FEATURE_KEYS) {
    if (rowMap[k] !== undefined) {
      next[k] = rowMap[k]!;
    } else if (!hasDbRows) {
      next[k] = base[k];
    } else if (FEATURE_MATRIX_SURVIVAL_KEYS.includes(k)) {
      next[k] = base[k];
    } else {
      next[k] = 'none';
    }
  }
  return next;
}
