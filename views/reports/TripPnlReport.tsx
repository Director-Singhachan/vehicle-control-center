const STORAGE_KEY = 'tripPnlReportFilters';

function getDefaultDateRange() {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const start = new Date(today);
  start.setMonth(start.getMonth() - 1);
  const startStr = start.toISOString().split('T')[0];
  return { start: startStr, end };
}

function loadSavedFilters(): { dateRange: { start: string; end: string }; vehicleId: string; branch: string } {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { dateRange: getDefaultDateRange(), vehicleId: '', branch: '' };
    const parsed = JSON.parse(raw) as { start?: string; end?: string; vehicleId?: string; branch?: string };
    const start = typeof parsed?.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.start) ? parsed.start : null;
    const end = typeof parsed?.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.end) ? parsed.end : null;
    if (start && end) {
      return {
        dateRange: { start, end },
        vehicleId: typeof parsed?.vehicleId === 'string' ? parsed.vehicleId : '',
        branch: typeof parsed?.branch === 'string' ? parsed.branch : '',
      };
    }
  } catch {
    /* ignore */
  }
  return { dateRange: getDefaultDateRange(), vehicleId: '', branch: '' };
}

function saveFilters(dateRange: { start: string; end: string }, vehicleId: string, branch: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ start: dateRange.start, end: dateRange.end, vehicleId: vehicleId || '', branch: branch || '' }));
  } catch {
    /* ignore */
  }
}

/**
 * Trip P&L Report (Phase 4)
 * ตารางเที่ยววิ่งในช่วง แสดงรายได้ ต้นทุนผันแปร ต้นทุนคงที่×วัน กำไรสุทธิต่อเที่ยว
 * คลิกแถวหรือปุ่ม "ดูการคำนวณ" เพื่อเปิดโมดัลแสดงภาพการคำนวณ
 * Filter (ช่วงวันที่ + รถ) ถูกบันทึกใน sessionStorage เพื่อคืนค่าเมื่อกลับจากหน้ารายละเอียดเที่ยว
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, RefreshCw, AlertCircle, Calculator, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { excelExport } from '../../utils/excelExport';
import { Modal } from '../../components/ui/Modal';
import { useTripPnl } from '../../hooks/useTripPnl';
import { useVehicles } from '../../hooks/useVehicles';
import { usePermissions } from '../../hooks';
import type { TripPnlRow, TripDaysSource } from '../../services/reports/tripPnlService';

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatMoney(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function daysSourceLabel(source: TripDaysSource): string {
  switch (source) {
    case 'trip_start_end':
      return 'จากวันเริ่ม–วันสิ้นสุดเที่ยว (trip_start_date / trip_end_date)';
    case 'trip_log':
      return 'จาก trip log (checkout → checkin)';
    case 'planned_date':
      return 'ใช้วันที่วางแผน (planned_date) เป็น 1 วัน';
    default:
      return String(source);
  }
}

interface TripPnlReportProps {
  isDark?: boolean;
  /** คลิกแถวแล้วไปหน้ารายละเอียดเที่ยว (กำหนดจาก ReportsView) */
  onNavigateToTrip?: (tripId: string) => void;
}

type VehicleRow = { id: string; plate: string | null; branch: string | null };

export const TripPnlReport: React.FC<TripPnlReportProps> = ({ isDark = false, onNavigateToTrip }) => {
  const { canViewTripPnl } = usePermissions();

  if (!canViewTripPnl) {
    return (
      <Card className={`p-6 ${isDark ? 'dark' : ''}`}>
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            ไม่มีสิทธิ์เข้าถึงหน้านี้
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            โปรดติดต่อผู้ดูแลระบบหากคุณคิดว่าควรมีสิทธิ์เข้าถึงรายงาน P&L ต่อเที่ยว
          </p>
        </div>
      </Card>
    );
  }

  const saved = loadSavedFilters();
  const [dateRange, setDateRange] = useState(saved.dateRange);
  const [vehicleId, setVehicleId] = useState<string>(saved.vehicleId);
  const [branchFilter, setBranchFilter] = useState<string>(saved.branch);
  const [vehicleSearchText, setVehicleSearchText] = useState('');
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);
  const [detailRow, setDetailRow] = useState<TripPnlRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const { vehicles } = useVehicles();

  useEffect(() => {
    saveFilters(dateRange, vehicleId, branchFilter);
  }, [dateRange, vehicleId, branchFilter]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(e.target as Node)) {
        setVehicleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const vehicleList = (vehicles ?? []) as VehicleRow[];
  const branches = useMemo(() => {
    const set = new Set<string>();
    vehicleList.forEach((v) => { if (v.branch) set.add(v.branch); });
    return Array.from(set).sort();
  }, [vehicleList]);
  const vehiclesByBranch = useMemo(() => {
    return branchFilter ? vehicleList.filter((v) => v.branch === branchFilter) : vehicleList;
  }, [vehicleList, branchFilter]);
  const filteredVehicles = useMemo(() => {
    const q = vehicleSearchText.trim().toLowerCase();
    if (!q) return vehiclesByBranch;
    return vehiclesByBranch.filter((v) => (v.plate ?? '').toLowerCase().includes(q));
  }, [vehiclesByBranch, vehicleSearchText]);
  const selectedVehicle = vehicleId ? vehicleList.find((v) => v.id === vehicleId) : null;
  const vehicleDisplayValue = selectedVehicle ? (selectedVehicle.plate ?? selectedVehicle.id.slice(0, 8)) : vehicleSearchText;
  const { rows, loading, error, refetch } = useTripPnl({
    startDate: dateRange.start,
    endDate: dateRange.end,
    vehicleId: vehicleId || null,
    enabled: true,
  });

  const vehicleIdsInBranch = useMemo(() => new Set(vehiclesByBranch.map((v) => v.id)), [vehiclesByBranch]);
  const displayRows = useMemo(() => {
    if (!branchFilter) return rows;
    return rows.filter((r) => vehicleIdsInBranch.has(r.vehicle_id));
  }, [rows, branchFilter, vehicleIdsInBranch]);

  const totals = useMemo(() => {
    return displayRows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        variable_cost: acc.variable_cost + r.variable_cost,
        fixed_cost: acc.fixed_cost + r.fixed_cost,
        personnel_cost: acc.personnel_cost + r.personnel_cost,
        net_profit: acc.net_profit + r.net_profit,
        count: acc.count + 1,
      }),
      { revenue: 0, variable_cost: 0, fixed_cost: 0, personnel_cost: 0, net_profit: 0, count: 0 }
    );
  }, [displayRows]);

  const handleExportExcel = () => {
    if (displayRows.length === 0) return;
    setExporting(true);
    try {
      const exportRows = displayRows.map((r) => ({
        trip_number: r.trip_number ?? '',
        planned_date: r.planned_date,
        vehicle_plate: r.vehicle_plate ?? '',
        revenue: r.revenue,
        variable_cost: r.variable_cost,
        fixed_cost: r.fixed_cost,
        personnel_cost: r.personnel_cost,
        net_profit: r.net_profit,
      }));
      excelExport.exportToExcel(
        exportRows,
        [
          { key: 'trip_number', label: 'รหัสเที่ยว', width: 16 },
          { key: 'planned_date', label: 'วันที่วางแผน', width: 14 },
          { key: 'vehicle_plate', label: 'ทะเบียนรถ', width: 14 },
          { key: 'revenue', label: 'รายได้ (บาท)', width: 16, format: excelExport.formatCurrency },
          { key: 'variable_cost', label: 'ต้นทุนผันแปร (บาท)', width: 18, format: excelExport.formatCurrency },
          { key: 'fixed_cost', label: 'ต้นทุนคงที่×วัน (บาท)', width: 20, format: excelExport.formatCurrency },
          { key: 'personnel_cost', label: 'ต้นทุนบุคลากร (บาท)', width: 18, format: excelExport.formatCurrency },
          { key: 'net_profit', label: 'กำไรสุทธิ (บาท)', width: 18, format: excelExport.formatCurrency },
        ],
        `Trip_PnL_${dateRange.start}_${dateRange.end}.xlsx`,
        'กำไรขาดทุนต่อเที่ยว'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className={`p-6 ${isDark ? 'dark' : ''}`}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              วันที่เริ่ม
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              วันที่สิ้นสุด
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              สาขา
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[140px]"
            >
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div ref={vehicleDropdownRef} className="relative min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              รถ (ทะเบียน)
            </label>
            <input
              type="text"
              value={vehicleDisplayValue}
              onChange={(e) => {
                setVehicleSearchText(e.target.value);
                setVehicleId('');
                setVehicleDropdownOpen(true);
              }}
              onFocus={() => setVehicleDropdownOpen(true)}
              placeholder="พิมพ์ทะเบียน..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            {vehicleDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => {
                    setVehicleId('');
                    setVehicleSearchText('');
                    setVehicleDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ทุกคัน
                </button>
                {filteredVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVehicleId(v.id);
                      setVehicleSearchText(v.plate ?? '');
                      setVehicleDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${v.id === vehicleId ? 'bg-enterprise-50 dark:bg-enterprise-900/30 text-enterprise-700 dark:text-enterprise-300' : 'text-slate-900 dark:text-white'}`}
                  >
                    {v.plate ?? v.id.slice(0, 8)}
                    {v.branch ? <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({v.branch})</span> : null}
                  </button>
                ))}
                {filteredVehicles.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">ไม่พบรถที่ตรงกับที่พิมพ์</div>
                )}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || displayRows.length === 0}
          >
            <Download className={`w-4 h-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
            Export Excel
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        {loading && displayRows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
            <span className="ml-3 text-slate-600 dark:text-slate-400">กำลังโหลด...</span>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>ไม่มีข้อมูลเที่ยวในช่วงที่เลือก</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                      เที่ยว / วันที่
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                      รถ
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      รายได้
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      ต้นทุนผันแปร
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      ต้นทุนคงที่ (×วัน)
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      ต้นทุนบุคลากร
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      กำไรสุทธิ
                    </th>
                    <th className="px-3 py-2 w-24 font-medium text-slate-600 dark:text-slate-300">
                      การคำนวณ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => (
                    <tr
                      key={r.tripId}
                      role="button"
                      tabIndex={0}
                      onClick={() => (onNavigateToTrip ? onNavigateToTrip(r.tripId) : setDetailRow(r))}
                      onKeyDown={(e) => e.key === 'Enter' && (onNavigateToTrip ? onNavigateToTrip(r.tripId) : setDetailRow(r))}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      title={onNavigateToTrip ? 'คลิกไปหน้ารายละเอียดเที่ยว' : undefined}
                    >
                      <td className="px-3 py-2 text-slate-900 dark:text-white">
                        <span className="font-medium">{r.trip_number ?? r.tripId.slice(0, 8)}</span>
                        <br />
                        <span className="text-slate-500 dark:text-slate-400 text-xs">
                          {formatDate(r.planned_date)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {r.vehicle_plate ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-white">
                        {formatMoney(r.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {formatMoney(r.variable_cost)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {formatMoney(r.fixed_cost)}
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                          ({r.trip_days} วัน)
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {formatMoney(r.personnel_cost)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          r.net_profit >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatMoney(r.net_profit)}
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailRow(r)}
                          title="ดูภาพการคำนวณเที่ยวนี้"
                        >
                          <Calculator className="w-4 h-4 mr-1" />
                          ดูการคำนวณ
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-medium">
                    <td className="px-3 py-3 text-slate-900 dark:text-white" colSpan={2}>
                      รวม {totals.count} เที่ยว
                    </td>
                    <td className="px-3 py-3 text-right text-slate-900 dark:text-white">
                      {formatMoney(totals.revenue)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                      {formatMoney(totals.variable_cost)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                      {formatMoney(totals.fixed_cost)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                      {formatMoney(totals.personnel_cost)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right ${
                        totals.net_profit >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatMoney(totals.net_profit)}
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>

          </>
        )}

        {/* โมดัลแสดงภาพการคำนวณ — ใช้ Portal ให้แสดงเหนือทุกชั้น */}
        {detailRow &&
          createPortal(
            <Modal
              isOpen={true}
              onClose={() => setDetailRow(null)}
              title={`การคำนวณ P&L — เที่ยว ${detailRow.trip_number ?? detailRow.tripId.slice(0, 8)} (${formatDate(detailRow.planned_date)})`}
              size="medium"
            >
              {detailRow.breakdown ? (
                <div className="space-y-5 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                    <span>รถ:</span>
                    <span className="font-medium text-slate-900 dark:text-white">{detailRow.vehicle_plate ?? '-'}</span>
                    <span>ช่วงวันเที่ยว:</span>
                    <span className="text-slate-900 dark:text-white">
                      {formatDate(detailRow.breakdown.date_range.start)} – {formatDate(detailRow.breakdown.date_range.end)}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">1. รายได้</h4>
                    <p className="text-slate-700 dark:text-slate-300">
                      ฟิลด์ <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">trip_revenue</code> = <strong>{formatMoney(detailRow.revenue)}</strong> บาท
                    </p>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">2. จำนวนวันเที่ยว</h4>
                    <p className="text-slate-700 dark:text-slate-300 mb-1">
                      <strong>{detailRow.trip_days}</strong> วัน — ที่มา: {daysSourceLabel(detailRow.breakdown.days_source)}
                    </p>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">3. ต้นทุนผันแปร</h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                      <li>ต้นทุนอื่นผูกเที่ยว (variable_costs + ค่าคอม): {formatMoney(detailRow.breakdown.variable.other)} บาท</li>
                      <li>ค่าน้ำมันในช่วงวันเที่ยว: {formatMoney(detailRow.breakdown.variable.fuel)} บาท</li>
                    </ul>
                    <p className="mt-2 font-medium text-slate-900 dark:text-white">
                      รวมต้นทุนผันแปร = {formatMoney(detailRow.variable_cost)} บาท
                    </p>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">4. ต้นทุนคงที่</h4>
                    <p className="text-slate-700 dark:text-slate-300">
                      ต้นทุนคงที่ต่อวัน = <strong>{formatMoney(detailRow.breakdown.daily_fixed_cost)}</strong> บาท/วัน<br />
                      × จำนวนวันเที่ยว {detailRow.trip_days} วัน = <strong>{formatMoney(detailRow.fixed_cost)}</strong> บาท
                    </p>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">5. ต้นทุนบุคลากร</h4>
                    <p className="text-slate-700 dark:text-slate-300">
                      เงินเดือนลูกเรือ (คนขับ + พนักงานบริการ) ปันส่วนตามวันเที่ยว จาก HR (staff_salaries) = <strong>{formatMoney(detailRow.personnel_cost)}</strong> บาท
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      ระบบนับว่าวันนั้นพนักงานคนนี้อยู่กี่เที่ยว (รวมทุกคันในช่วงที่เลือก) แล้วแบ่งต้นทุนวันนั้น (เงินเดือน/30) ให้แต่ละเที่ยวเท่าๆ กัน — ไม่คิดซ้ำแม้ไปหลายคัน
                    </p>
                    {detailRow.personnel_cost === 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        ถ้าเที่ยวนี้มีลูกเรือและใส่เงินเดือนในหน้าจัดการเงินเดือนแล้ว แต่ยังเป็น 0 ให้ตรวจสอบ: (1) ลูกเรือในเที่ยวมีสถานะ active (2) อัตราเงินเดือนใน HR ตั้งวันเริ่มต้น (effective_from) ไม่เกินวันเริ่มเที่ยว และวันสิ้นสุด (effective_to) ต้องว่างหรือไม่ก่อนวันเริ่มเที่ยว
                      </p>
                    )}
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">6. กำไรสุทธิ</h4>
                    <p className="text-slate-700 dark:text-slate-300 font-mono text-base">
                      {formatMoney(detailRow.revenue)} − {formatMoney(detailRow.variable_cost)} − {formatMoney(detailRow.fixed_cost)} − {formatMoney(detailRow.personnel_cost)} ={' '}
                      <strong className={detailRow.net_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {formatMoney(detailRow.net_profit)} บาท
                      </strong>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                  <p>รถ: <strong className="text-slate-900 dark:text-white">{detailRow.vehicle_plate ?? '-'}</strong></p>
                  <p>รายได้: {formatMoney(detailRow.revenue)} บาท</p>
                  <p>ต้นทุนผันแปร: {formatMoney(detailRow.variable_cost)} บาท</p>
                  <p>ต้นทุนคงที่: {formatMoney(detailRow.fixed_cost)} บาท ({detailRow.trip_days} วัน)</p>
                  <p>ต้นทุนบุคลากร: {formatMoney(detailRow.personnel_cost)} บาท</p>
                  <p className="font-medium">
                    กำไรสุทธิ: <span className={detailRow.net_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{formatMoney(detailRow.net_profit)} บาท</span>
                  </p>
                </div>
              )}
            </Modal>,
            document.body
          )}
      </div>
    </Card>
  );
};
