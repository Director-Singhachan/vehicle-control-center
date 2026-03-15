/**
 * Fleet P&L Report (Phase 6)
 * Dashboard มหภาค — รวมรายได้/ต้นทุน/กำไรสุทธิของรถทุกคัน
 * แสดงเป็นกราฟและตาราง
 */
import React, { useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { DollarSign, TrendingUp, Truck, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useFleetPnl } from '../../hooks/useFleetPnl';

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
  const { data, loading, error, refetch } = useFleetPnl({
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: !!dateRange.start && !!dateRange.end,
  });

  const chartData = useMemo(() => {
    if (!data) return null;
    return {
      labels: ['รวมทั้งกองรถ'],
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
  }, [data, isDark]);

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
          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-enterprise-600 text-white hover:bg-enterprise-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            โหลดใหม่
          </button>
        </div>
      </Card>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-red-700 dark:text-red-300 text-sm">
          {error.message}
        </div>
      )}

      {loading && !data ? (
        <Card className="p-8 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </Card>
      ) : data ? (
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
                    ทั้งบริษัท
                  </p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                  <Truck className="text-slate-600 dark:text-slate-300" size={24} />
                </div>
              </div>
            </Card>
          </div>

          {/* Chart: รายได้ vs ต้นทุน */}
          <Card className="p-5">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
              รายได้ vs ต้นทุน (ทั้งกองรถ)
            </h3>
            {chartData && (
              <div className="h-64">
                <Bar data={chartData} options={chartOptions} />
              </div>
            )}
          </Card>

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
