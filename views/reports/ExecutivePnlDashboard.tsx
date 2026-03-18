import React from 'react';
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
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useFleetPnl, useFleetPnlMonthly } from '../../hooks/useFleetPnl';
import { useVehicles } from '../../hooks/useVehicles';

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

export const ExecutivePnlDashboard: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const startDateObj = new Date(today);
  startDateObj.setMonth(startDateObj.getMonth() - 5);
  const start = startDateObj.toISOString().split('T')[0];

  const { vehicles } = useVehicles();
  const vehicleList = (vehicles ?? []) as { id: string; plate: string | null; branch: string | null }[];

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

    // map vehicle_id -> branch จาก master list รถ
    const branchByVehicleId = new Map<string, string | null>(
      vehicleList.map((v) => [v.id, v.branch ?? null])
    );

    const grouped = new Map<
      string,
      { revenue: number; variableCost: number; fixedCost: number; personnelCost: number; netProfit: number }
    >();

    fleetSummary.rows.forEach((r: any) => {
      const branch = branchByVehicleId.get(r.vehicle_id) || 'ไม่ระบุ';
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
      g.variableCost += Number(r.total_variable || 0);
      g.fixedCost += Number(r.total_fixed || 0);
      g.personnelCost += Number(r.total_personnel || 0);
      g.netProfit += Number(r.net_profit || 0);
    });

    return Array.from(grouped.entries()).map(([branch, v]) => ({
      branch,
      ...v,
    }));
  }, [fleetSummary, vehicleList]);

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

  // โครงสร้างรายได้/ต้นทุนตามเวลา (ใช้เฉพาะ field ที่มีจริงจาก FleetPnlMonthlyRow)
  const costStructure = React.useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return [];
    return monthlyData.map((r: any) => {
      const rev = Number(r.total_revenue || 0);
      const cost = Number(r.total_cost || 0);
      const total = rev + cost;
      if (!total) {
        return {
          monthLabel: r.month_label,
          revenueShare: 0,
          costShare: 0,
        };
      }
      return {
        monthLabel: r.month_label,
        revenueShare: rev / total,
        costShare: cost / total,
      };
    });
  }, [monthlyData]);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="space-y-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
        </div>

        <Card className="p-4 bg-white dark:bg-charcoal-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
            โครงสร้างรายได้/ต้นทุนตามเวลา
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            สัดส่วนรายได้ vs ต้นทุน ต่อเดือน
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
                  dataKey="revenueShare"
                  name="รายได้"
                  stackId="1"
                  stroke="#16a34a"
                  fill="#bbf7d0"
                />
                <Area
                  type="monotone"
                  dataKey="costShare"
                  name="ต้นทุน"
                  stackId="1"
                  stroke="#f97316"
                  fill="#fed7aa"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

