import React from 'react';
import { Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { excelExport } from '../../utils/excelExport';
import { useMonthlyFuelReport, useVehicleFuelComparison, useFuelTrend } from '../../hooks/useReports';
import { Line } from 'react-chartjs-2';

const formatNumber = (value: number, decimals: number = 1) => value.toFixed(decimals);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export interface FuelReportProps {
  months: number;
  isDark?: boolean;
}

export const FuelReport: React.FC<FuelReportProps> = ({ months, isDark = false }) => {
  const { data: monthlyFuelReport, loading: fuelLoading } = useMonthlyFuelReport(months);
  const { data: vehicleFuelComparison, loading: fuelComparisonLoading } =
    useVehicleFuelComparison(months);
  const { data: fuelTrend, loading: fuelTrendLoading } = useFuelTrend(months);

  const exportFuelReport = () => {
    if (!monthlyFuelReport || monthlyFuelReport.length === 0) return;
    excelExport.exportToExcel(
      monthlyFuelReport,
      [
        { key: 'monthLabel', label: 'เดือน', width: 15 },
        { key: 'totalLiters', label: 'รวมลิตร', width: 12, format: excelExport.formatNumber },
        { key: 'totalCost', label: 'รวมค่าใช้จ่าย (฿)', width: 18, format: excelExport.formatCurrency },
        {
          key: 'averagePricePerLiter',
          label: 'ราคาเฉลี่ยต่อลิตร (฿)',
          width: 20,
          format: excelExport.formatCurrency,
        },
        {
          key: 'averageEfficiency',
          label: 'ประสิทธิภาพเฉลี่ย (km/L)',
          width: 22,
          format: excelExport.formatNumber,
        },
        { key: 'fillCount', label: 'จำนวนครั้ง', width: 12 },
      ],
      `รายงานการใช้น้ำมัน_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการใช้น้ำมัน'
    );
  };

  return (
    <div className="space-y-6">
      {/* Monthly Fuel Trend Chart */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            กราฟแสดงการใช้น้ำมันรายเดือน
          </h3>
          <Button onClick={exportFuelReport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
        {fuelTrendLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400">กำลังโหลด...</div>
        ) : fuelTrend ? (
          <div className="h-64">
            <Line
              data={{
                labels: fuelTrend.labels,
                datasets: [
                  {
                    label: 'ค่าใช้จ่าย (฿)',
                    data: fuelTrend.costs,
                    borderColor: isDark ? '#8b5cf6' : '#7c3aed',
                    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y',
                  },
                  {
                    label: 'ประสิทธิภาพ (km/L)',
                    data: fuelTrend.efficiency,
                    borderColor: isDark ? '#10b981' : '#059669',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y1',
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
                  },
                },
                scales: {
                  y: {
                    type: 'linear' as const,
                    display: true,
                    position: 'left' as const,
                    ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { color: isDark ? '#334155' : '#e2e8f0' },
                  },
                  y1: {
                    type: 'linear' as const,
                    display: true,
                    position: 'right' as const,
                    ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    grid: { drawOnChartArea: false },
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">ไม่มีข้อมูล</div>
        )}
      </Card>

      {/* Vehicle Fuel Comparison */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          เปรียบเทียบค่าใช้จ่ายน้ำมันแต่ละรถ
        </h3>
        {fuelComparisonLoading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : vehicleFuelComparison && vehicleFuelComparison.length > 0 ? (
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
                    รวมลิตร
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ค่าใช้จ่าย (฿)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ประสิทธิภาพ (km/L)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    จำนวนครั้ง
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicleFuelComparison.map((vehicle) => (
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
                      {formatNumber(vehicle.totalLiters)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatCurrency(vehicle.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {vehicle.averageEfficiency ? formatNumber(vehicle.averageEfficiency) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                      {vehicle.fillCount}
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
