// Reports View - Comprehensive reports and analytics
import React, { useState } from 'react';
import {
  Droplet,
  Route,
  Wrench,
  DollarSign,
  Download,
  Calendar,
  TrendingUp,
  Truck,
  User,
  FileText,
  Package,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { excelExport } from '../utils/excelExport';
import {
  useMonthlyFuelReport,
  useVehicleFuelComparison,
  useFuelTrend,
  useMonthlyTripReport,
  useVehicleTripSummary,
  useDriverTripReport,
  useMonthlyMaintenanceReport,
  useVehicleMaintenanceComparison,
  useCostPerKm,
  useMonthlyCostTrend,
  useVehicleUsageRanking,
  useVehicleFuelConsumption,
  useDeliverySummaryByVehicle,
  useDeliverySummaryByStore,
  useDeliverySummaryByProduct,
  useMonthlyDeliveryReport,
} from '../hooks/useReports';
import { VehicleUsageRankingChart } from '../components/VehicleUsageRankingChart';
import { VehicleFuelConsumptionChart } from '../components/VehicleFuelConsumptionChart';
import { useVehicles } from '../hooks';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ReportsViewProps {
  isDark?: boolean;
  onNavigateToStoreDetail?: (storeId: string) => void;
}

type ReportTab = 'fuel' | 'trip' | 'maintenance' | 'cost' | 'usage' | 'fuel-consumption' | 'delivery';

type FilterPeriod = 'current-month' | 'last-3-months' | 'last-6-months' | 'last-12-months' | 'this-year' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({ isDark = false, onNavigateToStoreDetail }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('fuel');
  const [months, setMonths] = useState(6);
  
  // New filters for usage and fuel consumption charts
  // Default to last-3-months to show more data
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('last-3-months');
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const { vehicles } = useVehicles();
  
  // Get unique branches
  const branches = React.useMemo(() => {
    const branchSet = new Set<string>();
    vehicles?.forEach(v => {
      if (v.branch) branchSet.add(v.branch);
    });
    return Array.from(branchSet).sort();
  }, [vehicles]);
  
  // Calculate date range based on filter period - memoized to prevent unnecessary re-renders
  const { startDate, endDate } = React.useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    switch (filterPeriod) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last-3-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last-6-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'last-12-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        break;
      case 'this-year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return { startDate, endDate };
  }, [filterPeriod, customStartDate, customEndDate]);
  
  // Memoize options objects to prevent unnecessary re-renders
  const usageRankingOptions = React.useMemo(() => ({
    startDate,
    endDate,
    branch: selectedBranch || undefined,
    limit: 20,
  }), [startDate, endDate, selectedBranch]);
  
  const fuelConsumptionOptions = React.useMemo(() => ({
    startDate,
    endDate,
    branch: selectedBranch || undefined,
  }), [startDate, endDate, selectedBranch]);
  
  // Vehicle Usage Ranking
  const { data: vehicleUsageRanking, loading: usageRankingLoading } = useVehicleUsageRanking(usageRankingOptions);
  
  // Vehicle Fuel Consumption
  const { data: vehicleFuelConsumption, loading: fuelConsumptionLoading } = useVehicleFuelConsumption(fuelConsumptionOptions);

  // Fuel Reports
  const { data: monthlyFuelReport, loading: fuelLoading } = useMonthlyFuelReport(months);
  const { data: vehicleFuelComparison, loading: fuelComparisonLoading } = useVehicleFuelComparison(months);
  const { data: fuelTrend, loading: fuelTrendLoading } = useFuelTrend(months);

  // Trip Reports
  const { data: monthlyTripReport, loading: tripLoading } = useMonthlyTripReport(months);
  const { data: vehicleTripSummary, loading: tripSummaryLoading } = useVehicleTripSummary(months);
  const { data: driverTripReport, loading: driverTripLoading } = useDriverTripReport(months);

  // Maintenance Reports
  const { data: monthlyMaintenanceReport, loading: maintenanceLoading } = useMonthlyMaintenanceReport(months);
  const { data: vehicleMaintenanceComparison, loading: maintenanceComparisonLoading } = useVehicleMaintenanceComparison(months);

  // Cost Analysis
  const { data: costPerKm, loading: costPerKmLoading } = useCostPerKm(months);
  const { data: monthlyCostTrend, loading: costTrendLoading } = useMonthlyCostTrend(months);

  // Export functions
  const exportFuelReport = () => {
    if (!monthlyFuelReport || monthlyFuelReport.length === 0) return;

    excelExport.exportToExcel(
      monthlyFuelReport,
      [
        { key: 'monthLabel', label: 'เดือน', width: 15 },
        { key: 'totalLiters', label: 'รวมลิตร', width: 12, format: excelExport.formatNumber },
        { key: 'totalCost', label: 'รวมค่าใช้จ่าย (฿)', width: 18, format: excelExport.formatCurrency },
        { key: 'averagePricePerLiter', label: 'ราคาเฉลี่ยต่อลิตร (฿)', width: 20, format: excelExport.formatCurrency },
        { key: 'averageEfficiency', label: 'ประสิทธิภาพเฉลี่ย (km/L)', width: 22, format: excelExport.formatNumber },
        { key: 'fillCount', label: 'จำนวนครั้ง', width: 12 },
      ],
      `รายงานการใช้น้ำมัน_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการใช้น้ำมัน'
    );
  };

  const exportTripReport = () => {
    if (!monthlyTripReport || monthlyTripReport.length === 0) return;

    excelExport.exportToExcel(
      monthlyTripReport,
      [
        { key: 'monthLabel', label: 'เดือน', width: 15 },
        { key: 'totalTrips', label: 'จำนวนเที่ยว', width: 12 },
        { key: 'totalDistance', label: 'ระยะทางรวม (km)', width: 18, format: excelExport.formatNumber },
        { key: 'totalHours', label: 'เวลารวม (ชม.)', width: 15, format: excelExport.formatNumber },
        { key: 'averageDistance', label: 'ระยะทางเฉลี่ย (km)', width: 20, format: excelExport.formatNumber },
        { key: 'averageHours', label: 'เวลาเฉลี่ย (ชม.)', width: 18, format: excelExport.formatNumber },
      ],
      `รายงานการเดินทาง_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการเดินทาง'
    );
  };

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
        { key: 'totalMaintenanceCost', label: 'ค่าซ่อม (฿)', width: 18, format: excelExport.formatCurrency },
        { key: 'totalCost', label: 'รวมค่าใช้จ่าย (฿)', width: 18, format: excelExport.formatCurrency },
        { key: 'costPerKm', label: 'ค่าใช้จ่ายต่อ km (฿)', width: 20, format: excelExport.formatCurrency },
      ],
      `วิเคราะห์ค่าใช้จ่าย_${new Date().toISOString().split('T')[0]}.xlsx`,
      'วิเคราะห์ค่าใช้จ่าย'
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  return (
    <PageLayout
      title="รายงานและการวิเคราะห์"
      subtitle="สรุปข้อมูลการใช้น้ำมัน การเดินทาง การซ่อมบำรุง และค่าใช้จ่าย"
      actions={
        <div className="flex items-center gap-3">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value={3}>3 เดือนล่าสุด</option>
            <option value={6}>6 เดือนล่าสุด</option>
            <option value={12}>12 เดือนล่าสุด</option>
          </select>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('fuel')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'fuel'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Droplet className="inline-block w-4 h-4 mr-2" />
          รายงานน้ำมัน
        </button>
        <button
          onClick={() => setActiveTab('trip')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'trip'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Route className="inline-block w-4 h-4 mr-2" />
          รายงานการเดินทาง
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'maintenance'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Wrench className="inline-block w-4 h-4 mr-2" />
          รายงานการซ่อม
        </button>
        <button
          onClick={() => setActiveTab('cost')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'cost'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <DollarSign className="inline-block w-4 h-4 mr-2" />
          วิเคราะห์ค่าใช้จ่าย
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'usage'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="inline-block w-4 h-4 mr-2" />
          รถที่ใช้งานเยอะที่สุด
        </button>
        <button
          onClick={() => setActiveTab('fuel-consumption')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'fuel-consumption'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Droplet className="inline-block w-4 h-4 mr-2" />
          การเติมน้ำมันแต่ละคัน
        </button>
        <button
          onClick={() => setActiveTab('delivery')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'delivery'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Package className="inline-block w-4 h-4 mr-2" />
          รายงานการส่งสินค้า
        </button>
      </div>

      {/* Fuel Reports Tab */}
      {activeTab === 'fuel' && (
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
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รวมลิตร</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าใช้จ่าย (฿)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ประสิทธิภาพ (km/L)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนครั้ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleFuelComparison.map((vehicle) => (
                      <tr key={vehicle.vehicle_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{vehicle.plate}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.make} {vehicle.model}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalLiters)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatCurrency(vehicle.totalCost)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                          {vehicle.averageEfficiency ? formatNumber(vehicle.averageEfficiency) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{vehicle.fillCount}</td>
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
      )}

      {/* Trip Reports Tab */}
      {activeTab === 'trip' && (
        <div className="space-y-6">
          {/* Monthly Trip Report */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                รายงานการเดินทางรายเดือน
              </h3>
              <Button onClick={exportTripReport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
            {tripLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : monthlyTripReport && monthlyTripReport.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เดือน</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนเที่ยว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางรวม (km)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เวลารวม (ชม.)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางเฉลี่ย (km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTripReport.map((report) => (
                      <tr key={report.month} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{report.monthLabel}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{report.totalTrips}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(report.totalDistance, 0)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(report.totalHours, 1)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(report.averageDistance, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
            )}
          </Card>

          {/* Vehicle Trip Summary */}
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              สรุปการใช้รถแต่ละคัน
            </h3>
            {tripSummaryLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : vehicleTripSummary && vehicleTripSummary.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนเที่ยว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางรวม (km)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางเฉลี่ย (km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleTripSummary.map((vehicle) => (
                      <tr key={vehicle.vehicle_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{vehicle.plate}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.make} {vehicle.model}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{vehicle.totalTrips}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalDistance, 0)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.averageDistance, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
            )}
          </Card>

          {/* Driver Trip Report */}
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              รายงานพนักงานขับรถ
            </h3>
            {driverTripLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : driverTripReport && driverTripReport.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ชื่อพนักงาน</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนเที่ยว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางรวม (km)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เวลารวม (ชม.)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รถที่ใช้</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverTripReport.map((driver) => (
                      <tr key={driver.driver_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{driver.driver_name}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{driver.totalTrips}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(driver.totalDistance, 0)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(driver.totalHours, 1)}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {driver.vehicles_used.join(', ')}
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
      )}

      {/* Maintenance Reports Tab */}
      {activeTab === 'maintenance' && (
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
                    labels: monthlyMaintenanceReport.map(r => r.monthLabel),
                    datasets: [
                      {
                        label: 'ค่าใช้จ่ายการซ่อมบำรุง (฿)',
                        data: monthlyMaintenanceReport.map(r => r.totalCost),
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
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าใช้จ่ายรวม (฿)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนตั๋ว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าใช้จ่ายเฉลี่ย (฿)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ซ่อมล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleMaintenanceComparison.map((vehicle) => (
                      <tr key={vehicle.vehicle_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{vehicle.plate}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.make} {vehicle.model}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatCurrency(vehicle.totalCost)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{vehicle.ticketCount}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatCurrency(vehicle.averageCost)}</td>
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
      )}

      {/* Cost Analysis Tab */}
      {activeTab === 'cost' && (
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
                    labels: monthlyCostTrend.map(r => r.monthLabel),
                    datasets: [
                      {
                        label: 'ค่าน้ำมัน (฿)',
                        data: monthlyCostTrend.map(r => r.fuelCost),
                        backgroundColor: isDark ? '#10b981' : '#059669',
                        borderRadius: 4,
                      },
                      {
                        label: 'ค่าซ่อม (฿)',
                        data: monthlyCostTrend.map(r => r.maintenanceCost),
                        backgroundColor: isDark ? '#8b5cf6' : '#7c3aed',
                        borderRadius: 4,
                      },
                      {
                        label: 'รวม (฿)',
                        data: monthlyCostTrend.map(r => r.totalCost),
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
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางรวม (km)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าน้ำมัน (฿)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าซ่อม (฿)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รวมค่าใช้จ่าย (฿)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าใช้จ่ายต่อ km (฿)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costPerKm.map((vehicle) => (
                      <tr key={vehicle.vehicle_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{vehicle.plate}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.make} {vehicle.model}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalDistance, 0)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatCurrency(vehicle.totalFuelCost)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatCurrency(vehicle.totalMaintenanceCost)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold">{formatCurrency(vehicle.totalCost)}</td>
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
      )}

      {/* Vehicle Usage Ranking Tab */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ช่วงเวลา
                </label>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as FilterPeriod)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="current-month">เดือนปัจจุบัน</option>
                  <option value="last-3-months">3 เดือนล่าสุด</option>
                  <option value="last-6-months">6 เดือนล่าสุด</option>
                  <option value="last-12-months">12 เดือนล่าสุด</option>
                  <option value="this-year">ปีนี้</option>
                  <option value="custom">กำหนดเอง</option>
                </select>
              </div>
              {filterPeriod === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      วันที่เริ่มต้น
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      วันที่สิ้นสุด
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  สาขา
                </label>
                <select
                  value={selectedBranch || ''}
                  onChange={(e) => setSelectedBranch(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">ทุกสาขา</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Vehicle Usage Ranking Chart */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  กราฟรถที่วิ่งเยอะที่สุด
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  เรียงตามระยะทางรวม (km) - แสดง 20 อันดับแรก
                </p>
              </div>
            </div>
            {usageRankingLoading ? (
              <div className="h-96 flex items-center justify-center text-slate-400">กำลังโหลด...</div>
            ) : (
              <VehicleUsageRankingChart 
                data={vehicleUsageRanking || []} 
                isDark={isDark}
                limit={20}
              />
            )}
          </Card>

          {/* Vehicle Usage Ranking Table */}
          {vehicleUsageRanking && vehicleUsageRanking.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                ตารางสรุปการใช้งาน
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">อันดับ</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สาขา</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางรวม (km)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนเที่ยว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เวลารวม (ชม.)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางเฉลี่ย (km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleUsageRanking.map((vehicle, index) => (
                      <tr key={vehicle.vehicle_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `${index + 1}.`}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{vehicle.plate}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.make} {vehicle.model}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.branch || '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold">
                          {formatNumber(vehicle.totalDistance, 0)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{vehicle.totalTrips}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalHours, 1)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.averageDistance, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Vehicle Fuel Consumption Tab */}
      {activeTab === 'fuel-consumption' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ช่วงเวลา
                </label>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as FilterPeriod)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="current-month">เดือนปัจจุบัน</option>
                  <option value="last-3-months">3 เดือนล่าสุด</option>
                  <option value="last-6-months">6 เดือนล่าสุด</option>
                  <option value="last-12-months">12 เดือนล่าสุด</option>
                  <option value="this-year">ปีนี้</option>
                  <option value="custom">กำหนดเอง</option>
                </select>
              </div>
              {filterPeriod === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      วันที่เริ่มต้น
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      วันที่สิ้นสุด
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  สาขา
                </label>
                <select
                  value={selectedBranch || ''}
                  onChange={(e) => setSelectedBranch(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">ทุกสาขา</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Vehicle Fuel Consumption Chart */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  กราฟการเติมน้ำมันของแต่ละคัน
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  แสดงค่าใช้จ่ายและอัตราการบริโภคน้ำมัน (km/L)
                </p>
              </div>
            </div>
            {fuelConsumptionLoading ? (
              <div className="h-96 flex items-center justify-center text-slate-400">กำลังโหลด...</div>
            ) : (
              <VehicleFuelConsumptionChart 
                data={vehicleFuelConsumption || []} 
                isDark={isDark}
                showEfficiency={true}
                limit={20}
              />
            )}
          </Card>

          {/* Vehicle Fuel Consumption Table */}
          {vehicleFuelConsumption && vehicleFuelConsumption.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                ตารางสรุปการเติมน้ำมัน
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">อันดับ</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สาขา</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รวมลิตร</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าใช้จ่าย (฿)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนครั้ง</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ประสิทธิภาพ (km/L)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ราคาเฉลี่ย (฿/L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleFuelConsumption
                      .sort((a, b) => b.totalCost - a.totalCost)
                      .map((vehicle, index) => (
                        <tr key={vehicle.vehicle_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                            {index === 0 && '🥇'}
                            {index === 1 && '🥈'}
                            {index === 2 && '🥉'}
                            {index > 2 && `${index + 1}.`}
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{vehicle.plate}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {vehicle.make} {vehicle.model}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {vehicle.branch || '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalLiters, 2)}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold">{formatCurrency(vehicle.totalCost)}</td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{vehicle.fillCount}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                            {vehicle.averageEfficiency ? formatNumber(vehicle.averageEfficiency, 2) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatNumber(vehicle.averagePricePerLiter, 2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Delivery Reports Tab */}
      {activeTab === 'delivery' && (
        <DeliveryReportsTab
          startDate={startDate}
          endDate={endDate}
          isDark={isDark}
          onNavigateToStoreDetail={onNavigateToStoreDetail}
        />
      )}
    </PageLayout>
  );
};

// Delivery Reports Tab Component
const DeliveryReportsTab: React.FC<{
  startDate: Date;
  endDate: Date;
  isDark: boolean;
  onNavigateToStoreDetail?: (storeId: string) => void;
}> = ({ startDate, endDate, isDark, onNavigateToStoreDetail }) => {
  const [activeSubTab, setActiveSubTab] = useState<'vehicle' | 'store' | 'product' | 'monthly'>('vehicle');
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  
  const { data: vehicleData, loading: vehicleLoading } = useDeliverySummaryByVehicle(startDate, endDate);
  const { data: storeData, loading: storeLoading } = useDeliverySummaryByStore(startDate, endDate);
  const { data: productData, loading: productLoading } = useDeliverySummaryByProduct(startDate, endDate);
  const { data: monthlyData, loading: monthlyLoading } = useMonthlyDeliveryReport(6);

  const formatNumber = (value: number, decimals: number = 0) => {
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const exportVehicleReport = () => {
    if (!vehicleData || vehicleData.length === 0) return;
    excelExport.exportToExcel(
      vehicleData,
      [
        { key: 'plate', label: 'ทะเบียนรถ', width: 15 },
        { key: 'make', label: 'ยี่ห้อ', width: 15 },
        { key: 'model', label: 'รุ่น', width: 15 },
        { key: 'branch', label: 'สาขา', width: 15 },
        { key: 'totalTrips', label: 'จำนวนเที่ยว', width: 12, format: excelExport.formatNumber },
        { key: 'totalStores', label: 'จำนวนร้าน', width: 12, format: excelExport.formatNumber },
        { key: 'totalItems', label: 'จำนวนรายการ', width: 15, format: excelExport.formatNumber },
        { key: 'totalQuantity', label: 'จำนวนสินค้า', width: 15, format: excelExport.formatNumber },
        { key: 'totalDistance', label: 'ระยะทาง (กม.)', width: 15, format: excelExport.formatNumber },
        { key: 'averageItemsPerTrip', label: 'รายการ/เที่ยว', width: 15, format: (v: number) => v.toFixed(2) },
        { key: 'averageQuantityPerTrip', label: 'สินค้า/เที่ยว', width: 15, format: (v: number) => v.toFixed(2) },
        { key: 'averageStoresPerTrip', label: 'ร้าน/เที่ยว', width: 15, format: (v: number) => v.toFixed(2) },
      ],
      `รายงานการส่งสินค้าตามรถ_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการส่งสินค้าตามรถ'
    );
  };

  const exportStoreReport = () => {
    if (!storeData || storeData.length === 0) return;
    excelExport.exportToExcel(
      storeData.map(store => ({
        customer_code: store.customer_code,
        customer_name: store.customer_name,
        address: store.address || '',
        totalTrips: store.totalTrips,
        totalItems: store.totalItems,
        totalQuantity: store.totalQuantity,
      })),
      [
        { key: 'customer_code', label: 'รหัสลูกค้า', width: 15 },
        { key: 'customer_name', label: 'ชื่อร้าน', width: 25 },
        { key: 'address', label: 'ที่อยู่', width: 30 },
        { key: 'totalTrips', label: 'จำนวนเที่ยว', width: 12, format: excelExport.formatNumber },
        { key: 'totalItems', label: 'จำนวนรายการ', width: 15, format: excelExport.formatNumber },
        { key: 'totalQuantity', label: 'จำนวนสินค้า', width: 15, format: excelExport.formatNumber },
      ],
      `รายงานการส่งสินค้าตามร้าน_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการส่งสินค้าตามร้าน'
    );
  };

  const exportProductReport = () => {
    if (!productData || productData.length === 0) return;
    excelExport.exportToExcel(
      productData.map(product => ({
        product_code: product.product_code,
        product_name: product.product_name,
        category: product.category,
        unit: product.unit,
        totalQuantity: product.totalQuantity,
        totalDeliveries: product.totalDeliveries,
        totalStores: product.totalStores,
      })),
      [
        { key: 'product_code', label: 'รหัสสินค้า', width: 15 },
        { key: 'product_name', label: 'ชื่อสินค้า', width: 25 },
        { key: 'category', label: 'หมวดหมู่', width: 15 },
        { key: 'unit', label: 'หน่วย', width: 10 },
        { key: 'totalQuantity', label: 'จำนวนรวม', width: 15, format: excelExport.formatNumber },
        { key: 'totalDeliveries', label: 'จำนวนครั้งที่ส่ง', width: 18, format: excelExport.formatNumber },
        { key: 'totalStores', label: 'จำนวนร้าน', width: 12, format: excelExport.formatNumber },
      ],
      `รายงานการส่งสินค้าตามสินค้า_${new Date().toISOString().split('T')[0]}.xlsx`,
      'รายงานการส่งสินค้าตามสินค้า'
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveSubTab('vehicle')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'vehicle'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="inline-block w-4 h-4 mr-2" />
          ตามรถ
        </button>
        <button
          onClick={() => setActiveSubTab('store')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'store'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="inline-block w-4 h-4 mr-2" />
          ตามร้าน
        </button>
        <button
          onClick={() => setActiveSubTab('product')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'product'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Package className="inline-block w-4 h-4 mr-2" />
          ตามสินค้า
        </button>
        <button
          onClick={() => setActiveSubTab('monthly')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'monthly'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="inline-block w-4 h-4 mr-2" />
          รายเดือน
        </button>
      </div>

      {/* Vehicle Summary */}
      {activeSubTab === 'vehicle' && (
        <div className="space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                สรุปการส่งสินค้าตามรถ
              </h3>
              <Button onClick={exportVehicleReport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
            {vehicleLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : vehicleData && vehicleData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สาขา</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เที่ยว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ร้าน</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รายการ</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สินค้า</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทาง (กม.)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สินค้า/เที่ยว</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleData.map((vehicle) => (
                      <tr key={vehicle.vehicle_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{vehicle.plate}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{vehicle.branch || '-'}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalTrips)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalStores)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(vehicle.totalItems)}</td>
                        <td className="py-3 px-4 text-right font-medium text-enterprise-600 dark:text-enterprise-400">{formatNumber(vehicle.totalQuantity)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatNumber(vehicle.totalDistance, 1)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatNumber(vehicle.averageQuantityPerTrip, 1)}</td>
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
      )}

      {/* Store Summary */}
      {activeSubTab === 'store' && (
        <div className="space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                สรุปการส่งสินค้าตามร้าน
              </h3>
              <Button onClick={exportStoreReport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
            {storeLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : storeData && storeData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รหัสลูกค้า</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ชื่อร้าน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ที่อยู่</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เที่ยว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รายการ</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สินค้า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeData.map((store) => {
                      const isExpanded = expandedStores.has(store.store_id);
                      const sortedProducts = [...(store.products || [])].sort((a, b) => b.totalQuantity - a.totalQuantity);
                      
                      return (
                        <React.Fragment key={store.store_id}>
                          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => {
                            const newExpanded = new Set(expandedStores);
                            if (isExpanded) {
                              newExpanded.delete(store.store_id);
                            } else {
                              newExpanded.add(store.store_id);
                            }
                            setExpandedStores(newExpanded);
                          }}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-500" />
                                )}
                                <span className="font-medium text-slate-900 dark:text-slate-100">{store.customer_code}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{store.customer_name}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{store.address || '-'}</td>
                            <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(store.totalTrips)}</td>
                            <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(store.totalItems)}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-medium text-enterprise-600 dark:text-enterprise-400">{formatNumber(store.totalQuantity)}</span>
                                {onNavigateToStoreDetail && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateToStoreDetail(store.store_id);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-enterprise-600 dark:hover:text-enterprise-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                    title="ดูรายละเอียด"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && sortedProducts.length > 0 && (
                            <tr>
                              <td colSpan={6} className="py-4 px-4 bg-slate-50 dark:bg-slate-900/50">
                                <div className="ml-6">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                    รายละเอียดสินค้าที่ส่ง (เรียงตามจำนวนที่ส่ง)
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">รหัสสินค้า</th>
                                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">ชื่อสินค้า</th>
                                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">หน่วย</th>
                                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">จำนวนรวม</th>
                                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">จำนวนครั้ง</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sortedProducts.map((product) => (
                                          <tr key={product.product_id} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{product.product_code}</td>
                                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{product.product_name}</td>
                                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{product.unit}</td>
                                            <td className="py-2 px-3 text-right font-medium text-enterprise-600 dark:text-enterprise-400">{formatNumber(product.totalQuantity)}</td>
                                            <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{formatNumber(product.deliveryCount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">ไม่มีข้อมูล</div>
            )}
          </Card>
        </div>
      )}

      {/* Product Summary */}
      {activeSubTab === 'product' && (
        <div className="space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                สรุปการส่งสินค้าตามสินค้า
              </h3>
              <Button onClick={exportProductReport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
            {productLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : productData && productData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รหัสสินค้า</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ชื่อสินค้า</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">หมวดหมู่</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">หน่วย</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนรวม</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนครั้ง</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนร้าน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productData.map((product) => (
                      <tr key={product.product_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{product.product_code}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{product.product_name}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{product.category}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{product.unit}</td>
                        <td className="py-3 px-4 text-right font-medium text-enterprise-600 dark:text-enterprise-400">{formatNumber(product.totalQuantity)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(product.totalDeliveries)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(product.totalStores)}</td>
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
      )}

      {/* Monthly Report */}
      {activeSubTab === 'monthly' && (
        <div className="space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                รายงานการส่งสินค้ารายเดือน
              </h3>
            </div>
            {monthlyLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : monthlyData && monthlyData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เดือน</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เที่ยว</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ร้าน</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รายการ</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สินค้า</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทาง (กม.)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สินค้า/เที่ยว</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((month) => (
                      <tr key={month.month} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{month.monthLabel}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(month.totalTrips)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(month.totalStores)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(month.totalItems)}</td>
                        <td className="py-3 px-4 text-right font-medium text-enterprise-600 dark:text-enterprise-400">{formatNumber(month.totalQuantity)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatNumber(month.totalDistance, 1)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatNumber(month.averageQuantityPerTrip, 1)}</td>
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
      )}
    </div>
  );
};

