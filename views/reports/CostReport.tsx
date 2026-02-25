import React from 'react';
import { Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { excelExport } from '../../utils/excelExport';
import { useCostPerKm, useMonthlyCostTrend } from '../../hooks/useReports';
import { Bar } from 'react-chartjs-2';

const formatNumber = (value: number, decimals: number = 1) => value.toFixed(decimals);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export interface CostReportProps {
  months: number;
  isDark?: boolean;
}

export const CostReport: React.FC<CostReportProps> = ({ months, isDark = false }) => {
  const { data: costPerKm, loading: costPerKmLoading } = useCostPerKm(months);
  const { data: monthlyCostTrend, loading: costTrendLoading } = useMonthlyCostTrend(months);

  const exportCostAnalysis = () => {
    if (!costPerKm || costPerKm.length === 0) return;
    excelExport.exportToExcel(
      costPerKm,
      [
        { key: 'plate', label: 'ทะเบียน', width: 15 },
        { key: 'make', label: 'ยี่ห้อ', width: 15 },
        { key: 'model', label: 'รุ่น', width: 15 },
        { key: 'totalDistance', label: 'ระยะทางรวม (km)', width: 18, format: excelExport.formatNumber },
        { key: 'totalFuelCost', label: 'ค่าน้ำมัน (฿)', width: 15, format: excelExport.formatCurrency },
        {
          key: 'totalMaintenanceCost',
          label: 'ค่าซ่อม (฿)',
          width: 18,
          format: excelExport.formatCurrency,
        },
        { key: 'totalCost', label: 'รวมค่าใช้จ่าย (฿)', width: 18, format: excelExport.formatCurrency },
        { key: 'costPerKm', label: 'ค่าใช้จ่ายต่อ km (฿)', width: 20, format: excelExport.formatCurrency },
      ],
      `วิเคราะห์ค่าใช้จ่าย_${new Date().toISOString().split('T')[0]}.xlsx`,
      'วิเคราะห์ค่าใช้จ่าย'
    );
  };

  return (
    <div className="space-y-6">
      {/* Monthly Cost Trend Chart */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            กราฟแสดงค่าใช้จ่ายรายเดือน (น้ำมัน + ซ่อม)
          </h3>
          <Button onClick={exportCostAnalysis} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
        {costTrendLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400">กำลังโหลด...</div>
        ) : monthlyCostTrend && monthlyCostTrend.length > 0 ? (
          <div className="h-64">
            <Bar
              data={{
                labels: monthlyCostTrend.map((r) => r.monthLabel),
                datasets: [
                  {
                    label: 'ค่าน้ำมัน (฿)',
                    data: monthlyCostTrend.map((r) => r.fuelCost),
                    backgroundColor: isDark ? '#10b981' : '#059669',
                    borderRadius: 4,
                  },
                  {
                    label: 'ค่าซ่อม (฿)',
                    data: monthlyCostTrend.map((r) => r.maintenanceCost),
                    backgroundColor: isDark ? '#8b5cf6' : '#7c3aed',
                    borderRadius: 4,
                  },
                  {
                    label: 'รวม (฿)',
                    data: monthlyCostTrend.map((r) => r.totalCost),
                    backgroundColor: isDark ? '#f59e0b' : '#d97706',
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true },
                  tooltip: {
                    backgroundColor: isDark ? '#020617' : '#ffffff',
                    titleColor: isDark ? '#f8fafc' : '#0f172a',
                    bodyColor: isDark ? '#cbd5e1' : '#475569',
                    callbacks: {
                      label: (context) => formatCurrency(context.parsed.y),
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
                      callback: (value) => formatCurrency(Number(value)),
                    },
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">ไม่มีข้อมูล</div>
        )}
      </Card>

      {/* Cost Per Km */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          ค่าใช้จ่ายต่อ km แต่ละรถ
        </h3>
        {costPerKmLoading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : costPerKm && costPerKm.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ทะเบียน
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ยี่ห้อ/รุ่น
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางรวม (km)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ค่าน้ำมัน (฿)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ค่าซ่อม (฿)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    รวมค่าใช้จ่าย (฿)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ค่าใช้จ่ายต่อ km (฿)
                  </th>
                </tr>
              </thead>
              <tbody>
                {costPerKm.map((vehicle) => (
                  <tr
                    key={vehicle.vehicle_id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {vehicle.plate}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {vehicle.make} {vehicle.model}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(vehicle.totalDistance, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatCurrency(vehicle.totalFuelCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatCurrency(vehicle.totalMaintenanceCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold">
                      {formatCurrency(vehicle.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold text-enterprise-600 dark:text-enterprise-400">
                      {formatCurrency(vehicle.costPerKm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
        )}
      </Card>
    </div>
  );
};
