import React from 'react';
import { Search, Building2, RefreshCw, FileWarning } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { TrackBillIssueFilter } from '../../utils/orderBillCorrection';

interface TrackOrdersFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  branchFilter: string;
  onBranchChange: (value: string) => void;
  /** ตัวเลือกสาขา (รวม ALL) จากการตั้งค่า / สิทธิ์ */
  branchOptions: { value: string; label: string }[];
  /** true = เหลือสาขาเดียวที่อนุญาต — ล็อก dropdown */
  branchSelectDisabled?: boolean;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  billIssueFilter: TrackBillIssueFilter;
  onBillIssueFilterChange: (value: TrackBillIssueFilter) => void;
  /** จำนวนออเดอร์ที่เป็นเคสบิล (ในรายการที่โหลดแล้ว หลังสาขา — ใช้แสดงตัวเลขช่วยมอง) */
  billCaseCountInList?: number;
  onRefresh: () => void;
  loading: boolean;
}

export const TrackOrdersFilterBar: React.FC<TrackOrdersFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  branchFilter,
  onBranchChange,
  branchOptions,
  branchSelectDisabled = false,
  statusFilter,
  onStatusChange,
  billIssueFilter,
  onBillIssueFilterChange,
  billCaseCountInList,
  onRefresh,
  loading,
}) => {
  return (
    <Card className="mb-6 border-0 shadow-sm overflow-visible bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-xl ring-1 ring-slate-200/50 dark:ring-slate-700/50 relative z-20">
      <div className="p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 group-focus-within:text-enterprise-500 transition-colors" />
              <input
                type="text"
                placeholder="ค้นหาเลขออเดอร์, ร้านค้า, เลข SML อ้างอิง..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-charcoal-950 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-enterprise-500/50 dark:focus:ring-enterprise-400/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all outline-none"
              />
            </div>
          </div>

          {/* Branch Filter */}
          <div className="w-full md:w-56">
            <div className="relative group">
              <Building2 className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-enterprise-500 transition-colors" />
              <select
                value={branchFilter}
                onChange={(e) => onBranchChange(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 appearance-none border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-charcoal-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500/50 dark:focus:ring-enterprise-400/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={branchSelectDisabled}
              >
                {branchOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-52">
            <div className="relative group">
              <select
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 appearance-none border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-charcoal-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500/50 dark:focus:ring-enterprise-400/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all outline-none"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="pending">รอจัดทริป</option>
                <option value="partial">ส่งบางส่วน</option>
                <option value="assigned">กำหนดทริปแล้ว</option>
                <option value="in_delivery">กำลังจัดส่ง</option>
                <option value="delivered">จัดส่งแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Refresh Action */}
          <Button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center justify-center gap-2 shrink-0 py-2.5 px-5 bg-white text-slate-700 hover:bg-slate-50 hover:text-enterprise-600 border border-slate-200 dark:bg-charcoal-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-charcoal-800 dark:hover:text-enterprise-400 rounded-xl transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="font-medium">รีเฟรช</span>
          </Button>
        </div>

        {/* เคสบิล / แก้บิล — กรองจากฟิลด์ที่บันทึกในระบบแล้ว */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 shrink-0">
            <FileWarning className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden />
            <span className="text-sm font-medium">เคสบิล</span>
            {billCaseCountInList != null && billCaseCountInList > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-500">
                (ในรายการนี้มี {billCaseCountInList.toLocaleString('th-TH')} รายการที่ระบบทำเครื่องหมาย)
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 max-w-xl relative">
            <select
              value={billIssueFilter}
              onChange={(e) => onBillIssueFilterChange(e.target.value as TrackBillIssueFilter)}
              className="w-full pl-4 pr-10 py-2.5 appearance-none border border-slate-200 dark:border-slate-700 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40 dark:focus:ring-amber-400/30 hover:border-amber-300 dark:hover:border-amber-700 transition-all outline-none text-sm"
            >
              <option value="all">ทุกออเดอร์ (ไม่กรองเคสบิล)</option>
              <option value="any">เฉพาะที่เกี่ยวกับแก้บิล / บิลแทน (รวม)</option>
              <option value="follow_up">บิลใหม่ที่เชื่อมบิลเดิม (แก้บิล)</option>
              <option value="superseded">บิลเก่าที่มีบิลใหม่แทน</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 sm:max-w-md leading-snug">
            ระบบใช้ข้อมูลจากการผูกออเดอร์และเครื่องหมายใน DB — ถ้ายังไม่ได้บันทึกการผูก รายการจะไม่เข้าโหมดกรองนี้
          </p>
        </div>
      </div>
    </Card>
  );
};
