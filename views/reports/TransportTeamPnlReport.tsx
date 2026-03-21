/**
 * รายงานผลประกอบการทีมขนส่งหน้างาน — รายได้ทริปเทียบค่าจ้างทีม (ไม่รวมหลังบ้าน)
 */
import React, { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTransportTeamPnl } from '../../hooks/useTransportTeamPnl';
import { usePermissions } from '../../hooks';
import { BRANCH_FILTER_OPTIONS, BRANCH_ALL_VALUE } from '../../utils/branchLabels';

function formatMoney(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start.split('T')[0]);
  const b = new Date(end.split('T')[0]);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (86400000)) + 1);
}

function getDefaultMonthRange() {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  return { start, end };
}

export const TransportTeamPnlReport: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  const { canViewTripPnl, canViewFleetPnl } = usePermissions();
  const canView = canViewTripPnl || canViewFleetPnl;

  const [dateRange, setDateRange] = useState(getDefaultMonthRange);
  const [branch, setBranch] = useState<string>('');

  const rangeDays = useMemo(
    () => daysBetween(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end]
  );
  const includeDaily = rangeDays <= 45;

  const { data, loading, error, refetch } = useTransportTeamPnl({
    enabled: canView,
    startDate: dateRange.start,
    endDate: dateRange.end,
    branch: branch || null,
    includeDailyBreakdown: includeDaily,
  });

  const chartData = useMemo(() => {
    if (!data?.daily?.length) return null;
    return {
      labels: data.daily.map((r) => r.date.slice(5)),
      datasets: [
        {
          label: 'รายได้ทริป (บาท)',
          data: data.daily.map((r) => r.trip_revenue),
          backgroundColor: isDark ? '#22c55e' : '#16a34a',
          borderRadius: 4,
        },
        {
          label: 'ค่าจ้างทีม (บาท)',
          data: data.daily.map((r) => r.payroll_cost),
          backgroundColor: isDark ? '#f97316' : '#ea580c',
          borderRadius: 4,
        },
      ],
    };
  }, [data?.daily, isDark]);

  const setPreset = (preset: 'today' | 'week' | 'month') => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    if (preset === 'today') {
      setDateRange({ start: end, end });
      return;
    }
    if (preset === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const start = monday.toISOString().split('T')[0];
      setDateRange({ start, end });
      return;
    }
    setDateRange(getDefaultMonthRange());
  };

  if (!canView) {
    return (
      <Card className="p-6 dark:bg-charcoal-900 border-slate-200 dark:border-slate-700">
        <p className="text-center text-slate-600 dark:text-slate-400 py-8">
          ไม่มีสิทธิ์เข้าถึงรายงานนี้ — ต้องมีสิทธิ์ดู P&L ทริปหรือ Fleet P&L
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 dark:bg-charcoal-900 border-slate-200 dark:border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
              ผลประกอบการทีมขนส่ง (หน้างาน)
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              เปรียบเทียบรายได้จากทริปกับค่าจ้างพนักงานหน้างาน (คนขับ / พนักงานบริการ) ที่ active และเชื่อมบัญชี — รวมวันที่ไม่มีทริปในค่าจ้าง
              ไม่รวมทีมงานหลังบ้านและค่าใช้จ่ายอื่นขององค์กร
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPreset('today')}>
              วันนี้
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPreset('week')}>
              สัปดาห์นี้
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPreset('month')}>
              เดือนนี้
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={loading}
              className="gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ตั้งแต่วันที่</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-charcoal-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ถึงวันที่</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-charcoal-900 dark:text-white text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">สาขา (พนักงาน + ทริป)</label>
            <select
              value={branch || BRANCH_ALL_VALUE}
              onChange={(e) => {
                const v = e.target.value;
                setBranch(v === BRANCH_ALL_VALUE ? '' : v);
              }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-charcoal-900 dark:text-white text-sm"
            >
              {BRANCH_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {rangeDays > 45 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
            ช่วงมากกว่า 45 วัน — ซ่อนกราฟรายวันเพื่อความเร็ว
          </p>
        )}
      </Card>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <p className="text-slate-500 dark:text-slate-400 text-sm">กำลังโหลด…</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 dark:bg-charcoal-900 border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">รายได้จากทริปรวม</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">฿{formatMoney(data.trip_revenue_total)}</p>
              <p className="text-xs text-slate-500 mt-2">{data.trip_count} ทริป · {data.calendar_days} วัน</p>
            </Card>
            <Card className="p-5 dark:bg-charcoal-900 border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">ค่าจ้างทีมขนส่ง (ประมาณ)</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">฿{formatMoney(data.field_team_payroll_total)}</p>
              <p className="text-xs text-slate-500 mt-2">{data.field_staff_count} คน (active)</p>
            </Card>
            <Card className="p-5 dark:bg-charcoal-900 border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">ผลต่าง (หน้างาน)</p>
              <p
                className={`text-2xl font-bold mt-1 flex items-center gap-2 ${
                  data.net >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}
              >
                {data.net >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                {data.net >= 0 ? '' : '−'}฿{formatMoney(Math.abs(data.net))}
              </p>
            </Card>
          </div>

          {chartData && (
            <Card className="p-6 dark:bg-charcoal-900 border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">รายวัน (รายได้ vs ค่าจ้าง)</h3>
              <div className="h-72">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { stacked: false, ticks: { color: isDark ? '#94a3b8' : '#64748b' } },
                      y: {
                        beginAtZero: true,
                        ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                      },
                    },
                    plugins: {
                      legend: { labels: { color: isDark ? '#e2e8f0' : '#334155' } },
                    },
                  }}
                />
              </div>
            </Card>
          )}

          <Card className="p-5 dark:bg-charcoal-900 border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">หมายเหตุการคำนวณ</h3>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
              {data.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
};
