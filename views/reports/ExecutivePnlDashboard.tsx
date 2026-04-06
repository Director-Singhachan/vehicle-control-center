import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useFleetPnl, useFleetPnlMonthly } from '../../hooks/useFleetPnl';
import { useAuth } from '../../hooks/useAuth';
import {
  useExecutivePnlVisibility,
  type ExecutivePnlVisibility,
} from '../../hooks/useExecutivePnlVisibility';

interface SummaryKpi {
  label: string;
  value: string;
  delta?: string;
}

function formatCurrency(n: number): string {
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const SECTION_LABELS: { key: keyof ExecutivePnlVisibility; title: string; hint: string }[] = [
  { key: 'summaryKpis', title: 'ตัวเลขสรุป', hint: 'กำไรสุทธิ รายได้ ต้นทุน จำนวนรถ' },
  { key: 'branchPnl', title: 'P&L ตามสาขา', hint: 'กราฟเปรียบเทียบแต่ละสาขา' },
  { key: 'vehicleTop10', title: 'กำไรรายคัน Top 10', hint: 'เรียงจากกำไรสูงสุด' },
  { key: 'monthlyTrend', title: 'เทรนด์รายเดือน', hint: 'รายได้ ต้นทุน กำไรต่อเดือน' },
  { key: 'costStructure', title: 'โครงสร้างต้นทุนตามเวลา', hint: 'สัดส่วนผันแปร / คงที่ / บุคลากร' },
];

export const ExecutivePnlDashboard: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  const { profile } = useAuth();
  const { visibility, setSection, resetToDefault } = useExecutivePnlVisibility(profile?.id);

  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false);
  const visibilityPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showVisibilityPanel) return;
    const handler = (e: MouseEvent) => {
      if (
        visibilityPanelRef.current &&
        !visibilityPanelRef.current.contains(e.target as Node)
      ) {
        setShowVisibilityPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVisibilityPanel]);

  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const startDateObj = new Date(today);
  startDateObj.setMonth(startDateObj.getMonth() - 5);
  const start = startDateObj.toISOString().split('T')[0];

  const { data: fleetSummary } = useFleetPnl({
    startDate: start,
    endDate: end,
    vehicleIds: undefined,
    enabled: true,
  });

  const { data: monthlyData } = useFleetPnlMonthly({
    startDate: start,
    endDate: end,
    vehicleIds: undefined,
    enabled: true,
  });

  const themeGridColor = isDark ? '#1f2937' : '#e5e7eb';
  const themeTextColor = isDark ? '#e5e7eb' : '#4b5563';

  const summaryKpis: SummaryKpi[] = [
    {
      label: 'กำไรสุทธิรวม',
      value: fleetSummary ? `฿${formatCurrency(fleetSummary.net_profit)}` : '—',
    },
    {
      label: 'รายได้รวม',
      value: fleetSummary ? `฿${formatCurrency(fleetSummary.total_revenue)}` : '—',
    },
    {
      label: 'ต้นทุนรวม',
      value: fleetSummary ? `฿${formatCurrency(fleetSummary.total_cost)}` : '—',
    },
    {
      label: 'จำนวนรถที่ใช้งาน',
      value: fleetSummary ? String(fleetSummary.vehicle_count) : '—',
    },
  ];

  const branchPnl = React.useMemo(() => {
    if (!fleetSummary?.rows) return [];
    const grouped = new Map<
      string,
      { revenue: number; variableCost: number; fixedCost: number; personnelCost: number; netProfit: number }
    >();

    fleetSummary.rows.forEach((r: any) => {
      const branch = r.branch || 'ไม่ระบุ';
      if (!grouped.has(branch)) {
        grouped.set(branch, {
          revenue: 0,
          variableCost: 0,
          fixedCost: 0,
          personnelCost: 0,
          netProfit: 0,
        });
      }
      const g = grouped.get(branch)!;
      g.revenue += Number(r.revenue || 0);
      g.variableCost += Number(r.variable_cost || 0);
      g.fixedCost += Number(r.fixed_cost || 0);
      g.personnelCost += Number(r.personnel_cost || 0);
      g.netProfit += Number(r.net_profit || 0);
    });

    return Array.from(grouped.entries()).map(([branch, v]) => ({
      branch,
      ...v,
    }));
  }, [fleetSummary]);

  const vehiclePnl = React.useMemo(() => {
    if (!fleetSummary?.rows) return [];
    return fleetSummary.rows
      .map((r: any) => ({
        vehicleLabel: r.plate ?? r.vehicle_id.slice(0, 8),
        netProfit: Number(r.net_profit || 0),
      }))
      .sort((a: any, b: any) => b.netProfit - a.netProfit)
      .slice(0, 10);
  }, [fleetSummary]);

  const monthlyPnl = React.useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return [];
    return monthlyData.map((r: any) => ({
      monthLabel: r.month_label,
      revenue: Number(r.total_revenue || 0),
      cost: Number(r.total_cost || 0),
      netProfit: Number(r.net_profit || 0),
    }));
  }, [monthlyData]);

  const costStructure = React.useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return [];
    return monthlyData.map((r: any) => {
      const total =
        Number(r.variable_cost || 0) +
        Number(r.fixed_cost || 0) +
        Number(r.personnel_cost || 0);
      if (!total) {
        return {
          monthLabel: r.month_label,
          variableCost: 0,
          fixedCost: 0,
          personnelCost: 0,
        };
      }
      return {
        monthLabel: r.month_label,
        variableCost: Number(r.variable_cost || 0) / total,
        fixedCost: Number(r.fixed_cost || 0) / total,
        personnelCost: Number(r.personnel_cost || 0) / total,
      };
    });
  }, [monthlyData]);

  const anySectionVisible = Object.values(visibility).some(Boolean);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              แดชบอร์ดผู้บริหาร — Fleet P&L
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              เลือกบล็อกที่ต้องการแสดงได้เอง การตั้งค่าจำไว้ตามบัญชีผู้ใช้บนอุปกรณ์นี้
            </p>
          </div>
          <div
            ref={visibilityPanelRef}
            className={`relative shrink-0 sm:self-start ${showVisibilityPanel ? 'z-50' : ''}`}
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowVisibilityPanel((open) => !open)}
              className="inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden />
              ตั้งค่าการมองเห็น
              <ChevronDown className="w-4 h-4 opacity-70" aria-hidden />
            </Button>
            {showVisibilityPanel && (
              <div className="absolute right-0 mt-2 w-[min(calc(100vw-1.5rem),20rem)] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-charcoal-900 shadow-lg z-[60] p-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  แสดงบล็อกบนแดชบอร์ด
                </p>
                <div className="space-y-2 mb-3 max-h-[min(60vh,22rem)] overflow-y-auto pr-1">
                  {SECTION_LABELS.map(({ key, title, hint }) => (
                    <label key={key} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-charcoal-900 text-enterprise-600 focus:ring-enterprise-500"
                        checked={visibility[key]}
                        onChange={(e) => setSection(key, e.target.checked)}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <Button type="button" size="sm" variant="outline" className="w-full" onClick={resetToDefault}>
                  คืนค่าเริ่มต้น (แสดงทั้งหมด)
                </Button>
              </div>
            )}
          </div>
        </div>

        {!anySectionVisible ? (
          <Card className="p-8 text-center bg-white dark:bg-charcoal-900 border-dashed border-slate-300 dark:border-slate-600">
            <p className="text-slate-600 dark:text-slate-300">
              ยังไม่ได้เลือกรายการแสดง — กด 「ตั้งค่าการมองเห็น」 ด้านบนเพื่อเปิดบล็อกที่ต้องการ
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
        {visibility.summaryKpis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryKpis.map((kpi) => (
            <Card
              key={kpi.label}
              className="p-4 flex flex-col justify-between bg-white dark:bg-charcoal-900"
            >
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {kpi.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
                {kpi.value}
              </div>
              {kpi.delta && (
                <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  {kpi.delta}
                </div>
              )}
            </Card>
          ))}
        </div>
        )}

        {visibility.branchPnl && (
        <Card className="p-4 bg-white dark:bg-charcoal-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                โครงสร้าง P&L ตามสาขา
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เปรียบเทียบรายได้ ต้นทุน และกำไรสุทธิของแต่ละสาขา
              </p>
            </div>
            <Button size="sm" variant="outline">
              ปรับตัวกรอง (เร็ว ๆ นี้)
            </Button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchPnl} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke={themeGridColor} />
                <XAxis dataKey="branch" stroke={themeTextColor} />
                <YAxis stroke={themeTextColor} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#020617' : '#ffffff',
                    borderRadius: 8,
                    border: `1px solid ${themeGridColor}`,
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" name="รายได้" stackId="pnl" fill="#16a34a" />
                <Bar dataKey="variableCost" name="ต้นทุนผันแปร" stackId="pnl" fill="#f97316" />
                <Bar dataKey="fixedCost" name="ต้นทุนคงที่" stackId="pnl" fill="#0ea5e9" />
                <Bar dataKey="personnelCost" name="บุคลากร" stackId="pnl" fill="#6366f1" />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="กำไรสุทธิ"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  yAxisId={0}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        )}

        {(visibility.vehicleTop10 || visibility.monthlyTrend) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibility.vehicleTop10 && (
          <Card className="p-4 bg-white dark:bg-charcoal-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
              กำไร/ขาดทุนสุทธิรายคัน (Top 10)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              เรียงจากทำกำไรสูงสุดไปขาดทุนมากสุด
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={vehiclePnl}
                  layout="vertical"
                  margin={{ left: 80, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={themeGridColor} />
                  <XAxis type="number" stroke={themeTextColor} />
                  <YAxis
                    type="category"
                    dataKey="vehicleLabel"
                    stroke={themeTextColor}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#020617' : '#ffffff',
                      borderRadius: 8,
                      border: `1px solid ${themeGridColor}`,
                    }}
                    formatter={(value: any) => `฿${formatCurrency(Number(value || 0))}`}
                  />
                  <Bar
                    dataKey="netProfit"
                    name="กำไรสุทธิ"
                    radius={[4, 4, 4, 4]}
                    fill="#22c55e"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          )}

          {visibility.monthlyTrend && (
          <Card className="p-4 bg-white dark:bg-charcoal-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
              เทรนด์กำไร/ขาดทุนรายเดือน
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              เปรียบเทียบรายได้ ต้นทุน และกำไรสุทธิรายเดือน
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyPnl}>
                  <CartesianGrid strokeDasharray="3 3" stroke={themeGridColor} />
                  <XAxis dataKey="monthLabel" stroke={themeTextColor} />
                  <YAxis stroke={themeTextColor} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#020617' : '#ffffff',
                      borderRadius: 8,
                      border: `1px solid ${themeGridColor}`,
                    }}
                    formatter={(value: any) => `฿${formatCurrency(Number(value || 0))}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="รายได้"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    name="ต้นทุนรวม"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="กำไรสุทธิ"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          )}
        </div>
        )}

        {visibility.costStructure && (
        <Card className="p-4 bg-white dark:bg-charcoal-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
            โครงสร้างต้นทุนตามเวลา
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            สัดส่วนต้นทุนผันแปร / คงที่ / บุคลากร ต่อเดือน
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costStructure} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke={themeGridColor} />
                <XAxis dataKey="monthLabel" stroke={themeTextColor} />
                <YAxis
                  stroke={themeTextColor}
                  tickFormatter={(v) => formatPercent(Number(v || 0))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#020617' : '#ffffff',
                    borderRadius: 8,
                    border: `1px solid ${themeGridColor}`,
                  }}
                  formatter={(value: any) => formatPercent(Number(value || 0))}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="variableCost"
                  name="ผันแปร"
                  stackId="1"
                  stroke="#f97316"
                  fill="#fed7aa"
                />
                <Area
                  type="monotone"
                  dataKey="fixedCost"
                  name="คงที่"
                  stackId="1"
                  stroke="#0ea5e9"
                  fill="#bae6fd"
                />
                <Area
                  type="monotone"
                  dataKey="personnelCost"
                  name="บุคลากร"
                  stackId="1"
                  stroke="#6366f1"
                  fill="#c7d2fe"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        )}
          </div>
        )}
      </div>
    </div>
  );
};

