import type { LucideIcon } from 'lucide-react';
import { BarChart3, Package, Shield, ShoppingBag, Truck, Users } from 'lucide-react';
import type { AppRole } from '../../types/database';
import type { AccessLevel, FeatureKey } from '../../types/featureAccess';

export const FEATURE_LABELS: Partial<Record<FeatureKey, string>> = {
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

export const ROLE_LABELS_TH: Record<AppRole, string> = {
  user: 'ผู้ใช้ทั่วไป',
  inspector: 'สายตรวจ / ตรวจสอบ',
  manager: 'ผู้จัดการ',
  executive: 'ผู้บริหาร',
  admin: 'ผู้ดูแลระบบ',
  driver: 'พนักงานขับรถ',
  sales: 'ฝ่ายขาย',
  service_staff: 'เจ้าหน้าที่บริการ',
  hr: 'ฝ่ายบุคคล (HR)',
  accounting: 'บัญชี',
  warehouse: 'คลังสินค้า',
  dev: 'ผู้พัฒนา',
};

export function levelLabel(l: AccessLevel): string {
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

export function levelShort(l: AccessLevel): string {
  switch (l) {
    case 'none':
      return 'ไม่มี';
    case 'view':
      return 'ดู';
    case 'edit':
      return 'แก้ไข';
    case 'manage':
      return 'เต็ม';
    default:
      return l;
  }
}

export function levelSelectClasses(active: boolean, lvl: AccessLevel): string {
  const base =
    'min-w-0 flex-1 sm:flex-none rounded-lg px-3 py-2 text-sm font-medium min-h-[40px] sm:min-h-[36px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enterprise-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-charcoal-950 disabled:opacity-50 disabled:cursor-not-allowed';
  if (!active) {
    return `${base} text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-charcoal-800`;
  }
  switch (lvl) {
    case 'none':
      return `${base} bg-slate-600 text-white shadow-sm dark:bg-slate-500`;
    case 'view':
      return `${base} bg-enterprise-500 text-white shadow-sm dark:bg-enterprise-600`;
    case 'edit':
      return `${base} bg-amber-500 text-white shadow-sm dark:bg-amber-600`;
    case 'manage':
      return `${base} bg-emerald-600 text-white shadow-sm dark:bg-emerald-700`;
    default:
      return `${base} bg-enterprise-500 text-white`;
  }
}

export interface FeatureGroup {
  id: string;
  title: string;
  keys: FeatureKey[];
  icon: LucideIcon;
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'finance_reports',
    title: 'การเงิน / รายงาน',
    keys: ['tab.reports', 'report.pnl_trip', 'report.pnl_vehicle', 'report.pnl_fleet'],
    icon: BarChart3,
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
    icon: ShoppingBag,
  },
  {
    id: 'warehouse',
    title: 'คลังสินค้า',
    keys: ['tab.stock_dashboard', 'tab.warehouses', 'tab.inventory_receipts'],
    icon: Package,
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
    icon: Truck,
  },
  {
    id: 'hr',
    title: 'จัดการบุคคล / HR',
    keys: ['tab.admin_staff', 'tab.service_staff', 'tab.commission', 'tab.commission_rates'],
    icon: Users,
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
    icon: Shield,
  },
];
