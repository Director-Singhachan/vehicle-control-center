import React from 'react';
import { Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { excelExport } from '../../utils/excelExport';
import {
  useMonthlyMaintenanceReport,
  useVehicleMaintenanceComparison,
} from '../../hooks/useReports';
import { Bar } from 'react-chartjs-2';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export interface MaintenanceReportProps {
  months: number;
  isDark?: boolean;
}

export const MaintenanceReport: React.FC<MaintenanceReportProps> = ({
  months,
  isDark = false,
}) => {
  const { data: monthlyMaintenanceReport, loading: maintenanceLoading } =
    useMonthlyMaintenanceReport(months);
  const { data: vehicleMaintenanceComparison, loading: maintenanceComparisonLoading } =
    useVehicleMaintenanceComparison(months);

  const exportMaintenanceReport = () => {
    if (!monthlyMaintenanceReport || monthlyMaintenanceReport.length === 0) return;
    excelExport.exportToExcel(
      monthlyMaintenanceReport,
      [
        { key: 'monthLabel', label: 'เดือน', width: 15 },
        { key: 'totalCost', label: 'ค่าใช้จ่ายรวม (฿)', width: 18, format: excelExport.formatCurrency },
        { key: 'ticketCount', label: 'จำนวนตั๋ว', width: 12 },
        { key: 'averageCost', label: 'ค่าใช้จ่ายเฉลี่ย (฿)', width: 20, format: excelExport.formatCurrency },
      ],
      `รายงานการซ่อมบำรุง_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการซ่อมบำรุง'
    );
  };

  return (
    <div className="space-y-6">
      {/* Monthly Maintenance Chart */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            กราฟแสดงค่าซ่อมบำรุงรายเดือน
          </h3>
          <Button onClick={exportMaintenanceReport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
        {maintenanceLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400">กำลังโหลด...</div>
        ) : monthlyMaintenanceReport && monthlyMaintenanceReport.length > 0 ? (
          <div className="h-64">
            <Bar
              data={{
                labels: monthlyMaintenanceReport.map((r) => r.monthLabel),
                datasets: [
                  {
                    label: 'ค่าใช้จ่ายการซ่อมบำรุง (฿)',
                    data: monthlyMaintenanceReport.map((r) => r.totalCost),
                    backgroundColor: isDark ? '#8b5cf6' : '#7c3aed',
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
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

      {/* Vehicle Maintenance Comparison */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          เปรียบเทียบค่าซ่อมแต่ละรถ
        </h3>
        {maintenanceComparisonLoading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : vehicleMaintenanceComparison && vehicleMaintenanceComparison.length > 0 ? (
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
                    ค่าใช้จ่ายรวม (฿)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    จำนวนตั๋ว
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ค่าใช้จ่ายเฉลี่ย (฿)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ซ่อมล่าสุด
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicleMaintenanceComparison.map((vehicle) => (
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
                      {formatCurrency(vehicle.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                      {vehicle.ticketCount}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatCurrency(vehicle.averageCost)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {vehicle.lastMaintenanceDate
                        ? new Date(vehicle.lastMaintenanceDate).toLocaleDateString('th-TH')
                        : '-'}
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
