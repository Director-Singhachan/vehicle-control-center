/**
 * Fleet P&L Report (Phase 6)
 * Dashboard มหภาค — รวมรายได้/ต้นทุน/กำไรสุทธิของรถทุกคัน
 * แสดงเป็นกราฟและตาราง
 */
import React, { useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { DollarSign, TrendingUp, Truck, RefreshCw, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { excelExport } from '../../utils/excelExport';
import { useFleetPnl, useFleetPnlMonthly } from '../../hooks/useFleetPnl';
import { useVehicles } from '../../hooks/useVehicles';

function getDefaultDateRange() {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const start = new Date(today);
  start.setMonth(start.getMonth() - 1);
  return { start: start.toISOString().split('T')[0], end };
}

function formatMoney(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export interface FleetPnlReportProps {
  isDark?: boolean;
  onNavigateToVehicleDetail?: (vehicleId: string) => void;
}

export const FleetPnlReport: React.FC<FleetPnlReportProps> = ({
  isDark = false,
  onNavigateToVehicleDetail,
}) => {
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'range' | 'monthly'>('range');

  const { vehicles } = useVehicles();
  const vehicleList = (vehicles ?? []) as { id: string; plate: string | null; branch: string | null }[];
  const branches = useMemo(() => {
    const set = new Set<string>();
    vehicleList.forEach((v) => { if (v.branch) set.add(v.branch); });
    return Array.from(set).sort();
  }, [vehicleList]);
  const vehicleIdsInBranch = useMemo(() => {
    if (!branchFilter) return undefined;
    return vehicleList.filter((v) => v.branch === branchFilter).map((v) => v.id);
  }, [vehicleList, branchFilter]);

  const { data, loading, error, refetch } = useFleetPnl({
    startDate: dateRange.start,
    endDate: dateRange.end,
    vehicleIds: vehicleIdsInBranch,
    enabled: (!!dateRange.start && !!dateRange.end) && viewMode === 'range',
  });

  const { data: monthlyData, loading: monthlyLoading, error: monthlyError, refetch: refetchMonthly } = useFleetPnlMonthly({
    startDate: dateRange.start,
    endDate: dateRange.end,
    vehicleIds: vehicleIdsInBranch,
    enabled: (!!dateRange.start && !!dateRange.end) && viewMode === 'monthly',
  });

  const chartData = useMemo(() => {
    if (!data) return null;
    const scopeLabel = branchFilter ? `รวมสาขา ${branchFilter}` : 'รวมทั้งกองรถ';
    return {
      labels: [scopeLabel],
      datasets: [
        {
          label: 'รายได้รวม (฿)',
          data: [data.total_revenue],
          backgroundColor: isDark ? '#22c55e' : '#16a34a',
          borderRadius: 6,
        },
        {
          label: 'ต้นทุนรวม (฿)',
          data: [data.total_cost],
          backgroundColor: isDark ? '#f97316' : '#ea580c',
          borderRadius: 6,
        },
      ],
    };
  }, [data, isDark, branchFilter]);

  /** กราฟแนวนอน P&L รายคัน — เหมาะกับรถจำนวนมาก (40+), แสดงกำไร/ขาดทุนต่อคัน */
  const perVehicleChartData = useMemo(() => {
    if (!data || data.rows.length === 0) return null;
    const green = isDark ? '#22c55e' : '#16a34a';
    const red = isDark ? '#ef4444' : '#dc2626';
    return {
      labels: data.rows.map((r) => r.plate ?? r.vehicle_id.slice(0, 8)),
      datasets: [
        {
          label: 'กำไร/ขาดทุนสุทธิ (฿)',
          data: data.rows.map((r) => r.net_profit),
          backgroundColor: data.rows.map((r) => (r.net_profit >= 0 ? green : red)),
          borderRadius: 4,
        },
      ],
    };
  }, [data, isDark]);

  const perVehicleChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#020617' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          callbacks: {
            label: (context: { parsed: { x: number } }) =>
              `฿${formatMoney(context.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: isDark ? '#334155' : '#e2e8f0' },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            callback: (value: string | number) =>
              typeof value === 'number' ? `฿${(value / 1000).toFixed(0)}k` : value,
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            maxRotation: 0,
            autoSkip: false,
            font: { size: 11 },
          },
        },
      },
    }),
    [isDark]
  );

  /** ความสูงของกราฟรายคัน — ให้แต่ละแถวอ่านง่าย และเลื่อนดูได้เมื่อรถเยอะ */
  const perVehicleChartHeight = data?.rows.length
    ? Math.min(Math.max(data.rows.length * 28, 200), 1200)
    : 300;

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          backgroundColor: isDark ? '#020617' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          callbacks: {
            label: (context: { parsed: { y: number } }) =>
              `฿${formatMoney(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: isDark ? '#94a3b8' : '#64748b' },
        },
        y: {
          grid: { color: isDark ? '#334155' : '#e2e8f0' },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            callback: (value: string | number) =>
              typeof value === 'number' ? `฿${(value / 1000).toFixed(0)}k` : value,
          },
        },
      },
    }),
    [isDark]
  );

  const monthlyChartData = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return null;
    return {
      labels: monthlyData.map((r) => r.month_label),
      datasets: [
        {
          label: 'รายได้ (฿)',
          data: monthlyData.map((r) => r.total_revenue),
          backgroundColor: isDark ? '#22c55e' : '#16a34a',
          borderRadius: 4,
        },
        {
          label: 'ต้นทุน (฿)',
          data: monthlyData.map((r) => r.total_cost),
          backgroundColor: isDark ? '#f97316' : '#ea580c',
          borderRadius: 4,
        },
        {
          label: 'กำไรสุทธิ (฿)',
          data: monthlyData.map((r) => r.net_profit),
          backgroundColor: isDark ? '#3b82f6' : '#2563eb',
          borderRadius: 4,
        },
      ],
    };
  }, [monthlyData, isDark]);

  const handleExportExcel = () => {
    if (!data) return;
    setExporting(true);
    try {
      const summarySheet = [
        {
          start_date: data.start_date,
          end_date: data.end_date,
          vehicle_count: data.vehicle_count,
          total_revenue: data.total_revenue,
          total_cost: data.total_cost,
          net_profit: data.net_profit,
        },
      ];
      const rowsSheet = data.rows.map((r) => ({
        plate: r.plate ?? r.vehicle_id.slice(0, 8),
        revenue: r.revenue,
        total_cost: r.total_cost,
        net_profit: r.net_profit,
        cost_per_km: r.cost_per_km ?? '',
        cost_per_trip: r.cost_per_trip ?? '',
        cost_per_piece: r.cost_per_piece ?? '',
        total_trips: r.total_trips,
        total_distance_km: r.total_distance_km,
        total_pieces: r.total_pieces,
      }));
      excelExport.exportToExcelMultiSheet(
        [
          {
            sheetName: 'สรุปทั้งกองรถ',
            data: summarySheet,
            columns: [
              { key: 'start_date', label: 'วันที่เริ่ม', width: 12 },
              { key: 'end_date', label: 'วันที่สิ้นสุด', width: 12 },
              { key: 'vehicle_count', label: 'จำนวนรถ (คัน)', width: 14, format: excelExport.formatNumber },
              { key: 'total_revenue', label: 'รายได้รวม (บาท)', width: 18, format: excelExport.formatCurrency },
              { key: 'total_cost', label: 'ต้นทุนรวม (บาท)', width: 18, format: excelExport.formatCurrency },
              { key: 'net_profit', label: 'กำไรสุทธิ (บาท)', width: 18, format: excelExport.formatCurrency },
            ],
          },
          {
            sheetName: 'รายคัน',
            data: rowsSheet,
            columns: [
              { key: 'plate', label: 'ทะเบียน', width: 14 },
              { key: 'revenue', label: 'รายได้ (บาท)', width: 16, format: excelExport.formatCurrency },
              { key: 'total_cost', label: 'ต้นทุน (บาท)', width: 16, format: excelExport.formatCurrency },
              { key: 'net_profit', label: 'กำไรสุทธิ (บาท)', width: 16, format: excelExport.formatCurrency },
              { key: 'cost_per_km', label: 'ต้นทุน/กม. (บาท)', width: 16, format: (v: number | string) => (v === '' || v == null ? '-' : excelExport.formatCurrency(Number(v))) },
              { key: 'cost_per_trip', label: 'ต้นทุน/เที่ยว (บาท)', width: 18, format: (v: number | string) => (v === '' || v == null ? '-' : excelExport.formatCurrency(Number(v))) },
              { key: 'cost_per_piece', label: 'ต้นทุน/ชิ้น (บาท)', width: 18, format: (v: number | string) => (v === '' || v == null ? '-' : excelExport.formatCurrency(Number(v))) },
              { key: 'total_trips', label: 'จำนวนเที่ยว', width: 12, format: excelExport.formatNumber },
              { key: 'total_distance_km', label: 'ระยะทาง (กม.)', width: 14, format: (v: number) => excelExport.formatNumber(v, 1) },
              { key: 'total_pieces', label: 'จำนวนชิ้น', width: 12, format: excelExport.formatNumber },
            ],
          },
        ],
        `Fleet_PnL_${data.start_date}_${data.end_date}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportMonthlyExcel = () => {
    if (monthlyData.length === 0) return;
    setExporting(true);
    try {
      excelExport.exportToExcel(
        monthlyData.map((r) => ({
          month: r.month,
          month_label: r.month_label,
          total_revenue: r.total_revenue,
          total_cost: r.total_cost,
          net_profit: r.net_profit,
          vehicle_count: r.vehicle_count,
        })),
        [
          { key: 'month_label', label: 'เดือน', width: 14 },
          { key: 'total_revenue', label: 'รายได้รวม (บาท)', width: 18, format: excelExport.formatCurrency },
          { key: 'total_cost', label: 'ต้นทุนรวม (บาท)', width: 18, format: excelExport.formatCurrency },
          { key: 'net_profit', label: 'กำไรสุทธิ (บาท)', width: 18, format: excelExport.formatCurrency },
          { key: 'vehicle_count', label: 'จำนวนรถ (คัน)', width: 14, format: (v: number) => excelExport.formatNumber(v, 0) },
        ],
        `Fleet_PnL_รายเดือน_${dateRange.start}_${dateRange.end}.xlsx`,
        'สรุปรายเดือน'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`space-y-6 ${isDark ? 'dark' : ''}`}>
      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              วันที่เริ่ม
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
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
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
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
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">มุมมอง:</span>
            <button
              type="button"
              onClick={() => setViewMode('range')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'range'
                  ? 'bg-enterprise-600 text-white dark:bg-enterprise-500'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              ตามช่วง
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'monthly'
                  ? 'bg-enterprise-600 text-white dark:bg-enterprise-500'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              รายเดือน
            </button>
          </div>
          <button
            type="button"
            onClick={() => (viewMode === 'range' ? refetch() : refetchMonthly())}
            disabled={viewMode === 'range' ? loading : monthlyLoading}
            className="px-4 py-2 rounded-lg bg-enterprise-600 text-white hover:bg-enterprise-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading || monthlyLoading ? 'animate-spin' : ''} />
            โหลดใหม่
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => viewMode === 'range' ? handleExportExcel() : handleExportMonthlyExcel()}
            disabled={
              exporting ||
              (viewMode === 'range' ? !data || data.rows.length === 0 : monthlyData.length === 0)
            }
          >
            <Download className={`w-4 h-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
            Export Excel
          </Button>
        </div>
      </Card>

      {(error || monthlyError) && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-red-700 dark:text-red-300 text-sm">
          {(viewMode === 'range' ? error : monthlyError)?.message}
        </div>
      )}

      {viewMode === 'monthly' && (
        <>
          {monthlyLoading && monthlyData.length === 0 ? (
            <Card className="p-8 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
            </Card>
          ) : monthlyData.length > 0 ? (
            <>
              <Card className="p-5">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
                  สรุปรายเดือน — รายได้ vs ต้นทุน vs กำไรสุทธิ
                </h3>
                {monthlyChartData && (
                  <div className="h-72">
                    <Bar data={monthlyChartData} options={chartOptions} />
                  </div>
                )}
              </Card>
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    ตารางสรุปรายเดือน
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                        <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                          เดือน
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                          รายได้
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                          ต้นทุน
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                          กำไร/ขาดทุน
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                          จำนวนรถ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((row) => (
                        <tr
                          key={row.month}
                          className="border-b border-slate-100 dark:border-slate-700/50"
                        >
                          <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                            {row.month_label}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                            ฿{formatMoney(row.total_revenue)}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                            ฿{formatMoney(row.total_cost)}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-medium ${
                              row.net_profit >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {row.net_profit >= 0 ? '' : '−'}฿
                            {formatMoney(Math.abs(row.net_profit))}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">
                            {row.vehicle_count} คัน
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </>
      )}

      {viewMode === 'range' && loading && !data ? (
        <Card className="p-8 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </Card>
      ) : viewMode === 'range' && data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    รายได้รวม
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    ฿{formatMoney(data.total_revenue)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {data.vehicle_count} คัน
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="text-green-600 dark:text-green-400" size={24} />
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    ต้นทุนรวม
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    ฿{formatMoney(data.total_cost)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    คงที่ + ผันแปร
                  </p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <DollarSign className="text-amber-600 dark:text-amber-400" size={24} />
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    กำไร/ขาดทุนสุทธิ
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      data.net_profit >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {data.net_profit >= 0 ? '' : '−'}฿
                    {formatMoney(Math.abs(data.net_profit))}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {branchFilter ? `สาขา ${branchFilter}` : 'ทั้งบริษัท'}
                  </p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                  <Truck className="text-slate-600 dark:text-slate-300" size={24} />
                </div>
              </div>
            </Card>
          </div>

          {/* Chart: รายได้ vs ต้นทุน (ภาพรวม) */}
          <Card className="p-5">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
              รายได้ vs ต้นทุน {branchFilter ? `(สาขา ${branchFilter})` : '(ทั้งกองรถ)'}
            </h3>
            {chartData && (
              <div className="h-64">
                <Bar data={chartData} options={chartOptions} />
              </div>
            )}
          </Card>

          {/* กราฟ P&L รายคัน — แนวนอน เลื่อนได้ เหมาะกับรถ 40+ คัน */}
          {perVehicleChartData && data && data.rows.length > 0 && (
            <Card className="p-5">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
                กำไร/ขาดทุนสุทธิ รายคัน ({data.rows.length} คัน)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                สีเขียว = กำไร สีแดง = ขาดทุน — เลื่อนลงเพื่อดูทุกคัน
              </p>
              <div
                className="w-full overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700"
                style={{ maxHeight: 520 }}
              >
                <div style={{ height: perVehicleChartHeight, minHeight: 200 }}>
                  <Bar data={perVehicleChartData} options={perVehicleChartOptions} />
                </div>
              </div>
            </Card>
          )}

          {/* Table ต่อคัน */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                สรุป P&L รายคัน ({data.rows.length} คัน)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                      ทะเบียน
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      รายได้
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      ต้นทุน
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                      กำไร/ขาดทุน
                    </th>
                    {onNavigateToVehicleDetail && (
                      <th className="px-4 py-2 w-24" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr
                      key={row.vehicle_id}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2 text-slate-900 dark:text-white font-medium">
                        {row.plate ?? row.vehicle_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                        ฿{formatMoney(row.revenue)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                        ฿{formatMoney(row.total_cost)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          row.net_profit >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {row.net_profit >= 0 ? '' : '−'}฿
                        {formatMoney(Math.abs(row.net_profit))}
                      </td>
                      {onNavigateToVehicleDetail && (
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToVehicleDetail(row.vehicle_id)
                            }
                            className="text-enterprise-600 dark:text-enterprise-400 hover:underline text-sm"
                          >
                            ดูรถ
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-semibold">
                    <td className="px-4 py-2 text-slate-900 dark:text-white">
                      รวม
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900 dark:text-white">
                      ฿{formatMoney(data.total_revenue)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900 dark:text-white">
                      ฿{formatMoney(data.total_cost)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        data.net_profit >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {data.net_profit >= 0 ? '' : '−'}฿
                      {formatMoney(Math.abs(data.net_profit))}
                    </td>
                    {onNavigateToVehicleDetail && <td className="px-4 py-2" />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};
