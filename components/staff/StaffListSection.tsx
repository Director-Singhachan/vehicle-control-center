import React from 'react';
import {
  Search,
  UserCog,
  KeyRound,
  MoreVertical,
  ShieldOff,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SkeletonCard } from '../ui/Skeleton';
import type { StaffProfile, StaffListFilters } from '../../services/adminStaffService';
import type { AppRole } from '../../types/database';

const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  hr: 'HR',
  accounting: 'บัญชี',
  warehouse: 'คลัง',
  driver: 'คนขับ',
  service_staff: 'บริการ',
  sales: 'ขาย',
  inspector: 'ตรวจสอบ',
  executive: 'ผู้บริหาร',
  user: 'User',
};

const ROLE_COLOR: Partial<Record<AppRole, string>> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
  manager: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
  hr: 'bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300',
  accounting: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300',
  warehouse: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
  driver: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  service_staff: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300',
  sales: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300',
};

const FILTER_ROLES: { value: AppRole | ''; label: string }[] = [
  { value: '', label: 'ทุกบทบาท' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'accounting', label: 'บัญชี' },
  { value: 'warehouse', label: 'คลัง' },
  { value: 'driver', label: 'คนขับ' },
  { value: 'service_staff', label: 'บริการ' },
  { value: 'sales', label: 'ขาย' },
];

interface StaffListSectionProps {
  staffList: StaffProfile[];
  loading: boolean;
  error: string | null;
  filters: StaffListFilters;
  branches: string[];
  onFilterChange: (filters: StaffListFilters) => void;
  onRefetch: () => void;
  onEdit: (staff: StaffProfile) => void;
  onResetPassword: (staff: StaffProfile) => void;
  onToggleStatus: (staff: StaffProfile) => void;
}

function ActionMenu({
  staff,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: {
  staff: StaffProfile;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleStatus: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isBanned = (staff as any).is_banned;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <UserCog size={14} />
            แก้ไขข้อมูล
          </button>
          <button
            onClick={() => { onResetPassword(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <KeyRound size={14} />
            รีเซ็ตรหัสผ่าน
          </button>
          <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
          <button
            onClick={() => { onToggleStatus(); setOpen(false); }}
            className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
              isBanned
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isBanned ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
            {isBanned ? 'เปิดบัญชี' : 'ปิดบัญชี'}
          </button>
        </div>
      )}
    </div>
  );
}

export const StaffListSection: React.FC<StaffListSectionProps> = ({
  staffList,
  loading,
  error,
  filters,
  branches,
  onFilterChange,
  onRefetch,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) => {
  return (
    <Card padding="none">
      {/* ── Search & Filter bar ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
          />
        </div>
        <select
          value={filters.role || ''}
          onChange={(e) => onFilterChange({ ...filters, role: e.target.value as AppRole | '' })}
          className="py-2 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
        >
          {FILTER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={filters.branch || ''}
          onChange={(e) => onFilterChange({ ...filters, branch: e.target.value })}
          className="py-2 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
        >
          <option value="">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={onRefetch}>
          <RefreshCw size={14} className="mr-1.5" />
          รีเฟรช
        </Button>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      {loading && (
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-14" />)}
        </div>
      )}

      {error && !loading && (
        <div className="p-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
      )}

      {!loading && !error && staffList.length === 0 && (
        <div className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
          ไม่พบพนักงานที่ตรงกับเงื่อนไข
        </div>
      )}

      {!loading && !error && staffList.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  รหัส
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                  ชื่อ-นามสกุล
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                  บทบาท
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                  สาขา
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">
                  แผนก
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                  เบอร์โทร
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  สถานะ
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {staffList.map((staff) => {
                const isBanned = (staff as any).is_banned;
                const roleCls = ROLE_COLOR[staff.role] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

                return (
                  <tr
                    key={staff.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                      isBanned ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-enterprise-600 dark:text-enterprise-400">
                        {staff.employee_code || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {staff.full_name || '—'}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {staff.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleCls}`}>
                        {ROLE_LABEL[staff.role] ?? staff.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                      {staff.branch || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">
                      {staff.department || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                      {staff.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isBanned
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'
                        }`}
                      >
                        {isBanned ? 'ปิดอยู่' : 'ใช้งาน'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ActionMenu
                        staff={staff}
                        onEdit={() => onEdit(staff)}
                        onResetPassword={() => onResetPassword(staff)}
                        onToggleStatus={() => onToggleStatus(staff)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            ทั้งหมด {staffList.length} คน
          </div>
        </div>
      )}
    </Card>
  );
};
