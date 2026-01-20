// Fuel Log List View - Display fuel fill-up history
import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Gauge,
  Droplet,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileText,
  User,
  X,
  Edit2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { Avatar } from '../components/ui/Avatar';
import { ImageModal } from '../components/ui/ImageModal';
import { useFuelLogs, useFuelStats, useVehicles, useVehicleEfficiencyComparison } from '../hooks';
import { useVehicleFuelComparison, useFuelTrend } from '../hooks/useReports';
import type { Database } from '../types/database';
import { fuelService } from '../services/fuelService';
import { FuelLogEditView } from './FuelLogEditView';
import { excelExport } from '../utils/excelExport';
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

type FuelRecord = Database['public']['Tables']['fuel_records']['Row'];

interface FuelLogListViewProps {
  onCreate?: () => void;
}

const FUEL_TYPE_LABELS: Record<string, string> = {
  gasoline_91: 'เบนซิน 91',
  gasoline_95: 'เบนซิน 95',
  gasohol_91: 'แก๊สโซฮอล์ 91',
  gasohol_95: 'แก๊สโซฮอล์ 95',
  diesel: 'ดีเซล',
  e20: 'E20',
  e85: 'E85',
};

export const FuelLogListView: React.FC<FuelLogListViewProps> = ({
  onCreate,
}) => {
  const { vehicles } = useVehicles();
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedVehicleImage, setSelectedVehicleImage] = useState<{ url: string; alt: string } | null>(null);
  const [editFuelRecordId, setEditFuelRecordId] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    vehicle_id?: string;
    start_date?: string;
    end_date?: string;
    fuel_type?: string;
    branch?: string;
  }>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('');
  const itemsPerPage = 20;

  // Calculate pagination
  const offset = (currentPage - 1) * itemsPerPage;

  // Fetch fuel logs with server-side pagination
  const { fuelLogs, totalCount, loading, error, refetch } = useFuelLogs({
    ...filters,
    limit: itemsPerPage,
    offset: offset,
  });

  // Fetch fuel stats
  const { stats } = useFuelStats(filters);

  // Fetch chart data (use 6 months for comparison)
  const chartOptions = useMemo(() => ({
    startDate: filters.start_date ? new Date(filters.start_date) : undefined,
    endDate: filters.end_date ? new Date(filters.end_date) : undefined,
    branch: filters.branch,
  }), [filters.start_date, filters.end_date, filters.branch]);

  const { data: vehicleFuelComparison, loading: comparisonLoading } = useVehicleFuelComparison(6, chartOptions);
  const { data: fuelTrend, loading: trendLoading } = useFuelTrend(6, chartOptions);

  // Fetch vehicle efficiency comparison
  const { comparison: vehicleEfficiency, loading: efficiencyLoading } = useVehicleEfficiencyComparison(6, {
    startDate: filters.start_date,
    endDate: filters.end_date,
    branch: filters.branch,
  });

  // Debug logging
  useEffect(() => {
    console.log('[FuelLogListView] Chart data:', {
      vehicleFuelComparison: vehicleFuelComparison ? {
        length: vehicleFuelComparison.length,
        data: vehicleFuelComparison.slice(0, 3).map(v => ({
          plate: v.plate,
          totalCost: v.totalCost,
          totalLiters: v.totalLiters,
        })),
      } : null,
      fuelTrend: fuelTrend ? {
        hasLabels: !!fuelTrend.labels,
        labelsCount: fuelTrend.labels?.length || 0,
        labels: fuelTrend.labels?.slice(0, 3),
        hasCosts: !!fuelTrend.costs,
        costsCount: fuelTrend.costs?.length || 0,
        costs: fuelTrend.costs?.slice(0, 3),
        hasLiters: !!fuelTrend.liters,
        litersCount: fuelTrend.liters?.length || 0,
        liters: fuelTrend.liters?.slice(0, 3),
      } : null,
      comparisonLoading,
      trendLoading,
    });
  }, [vehicleFuelComparison, fuelTrend, comparisonLoading, trendLoading]);

  // Pagination (using server-side count)
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = offset;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      // Fetch all data matching current filters
      const { data } = await fuelService.getFuelHistory({
        ...filters,
        limit: 10000, // Large limit to get all records
        offset: 0
      });

      // Prepare columns
      const columns = [
        { key: 'filled_at', label: 'วันที่เติม', format: excelExport.formatDateTime },
        { key: 'plate', label: 'ทะเบียนรถ' },
        { key: 'branch', label: 'สาขา' },
        { key: 'fuel_type', label: 'ประเภทน้ำมัน', format: (v: string) => FUEL_TYPE_LABELS[v] || v },
        { key: 'odometer', label: 'เลขไมล์ (km)', format: excelExport.formatNumber },
        { key: 'distance_since_last_fill', label: 'ระยะทางที่วิ่งได้ (km)', format: excelExport.formatNumber },
        { key: 'liters', label: 'จำนวนลิตร', format: (v: number) => excelExport.formatNumber(v, 2) },
        { key: 'price_per_liter', label: 'ราคา/ลิตร', format: (v: number) => excelExport.formatCurrency(v) },
        { key: 'total_cost', label: 'ราคารวม', format: (v: number) => excelExport.formatCurrency(v) },
        { key: 'fuel_efficiency', label: 'อัตราสิ้นเปลือง (km/L)', format: (v: number) => excelExport.formatNumber(v, 2) },
        { key: 'fuel_station', label: 'สถานีบริการ' },
        { key: 'full_name', label: 'ผู้เติม' },
        { key: 'notes', label: 'หมายเหตุ' }
      ];

      // Map data to flat structure for export
      const exportData = data.map(record => ({
        ...record,
        plate: record.vehicle?.plate || 'N/A',
        branch: record.vehicle?.branch || '-',
        full_name: record.user?.full_name || 'N/A',
      }));

      excelExport.exportToExcel(exportData, columns, 'fuel_history_export.xlsx', 'Fuel History');
    } catch (error) {
      console.error('Export failed:', error);
      alert('เกิดข้อผิดพลาดในการ Export ข้อมูล');
    } finally {
      setExporting(false);
    }
  };

  const selectedVehicle = vehicles.find(v => v.id === filters.vehicle_id);

  // Get unique branches from vehicles
  const branches = useMemo(() => {
    const uniqueBranches = new Set<string>();
    vehicles.forEach(v => {
      if (v.branch) {
        uniqueBranches.add(v.branch);
      }
    });
    return Array.from(uniqueBranches).sort();
  }, [vehicles]);

  // Filter vehicles by branch if branch filter is selected
  const filteredVehicles = useMemo(() => {
    if (!filters.branch) return vehicles;
    return vehicles.filter(v => v.branch === filters.branch);
  }, [vehicles, filters.branch]);

  // Get vehicle IDs for the selected branch (if branch filter is active but no specific vehicle selected)
  const branchVehicleIds = useMemo(() => {
    if (!filters.branch || filters.vehicle_id) return undefined;
    return filteredVehicles.map(v => v.id);
  }, [filteredVehicles, filters.branch, filters.vehicle_id]);

  const displayedFuelLogs = fuelLogs;
  const displayedTotalCount = totalCount;

  if (editFuelRecordId) {
    return (
      <FuelLogEditView
        fuelRecordId={editFuelRecordId}
        onSave={() => {
          setEditFuelRecordId(null);
          refetch();
        }}
        onCancel={() => setEditFuelRecordId(null)}
      />
    );
  }

  return (
    <PageLayout
      title="ประวัติการเติมน้ำมัน"
      subtitle={loading ? 'กำลังโหลด...' : `ทั้งหมด ${displayedTotalCount.toLocaleString('th-TH')} รายการ${totalPages > 1 ? ` (หน้า ${currentPage}/${totalPages})` : ''}`}
      actions={
        <div className="flex gap-2">
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="w-4 h-4 mr-2" />
              บันทึกการเติมน้ำมัน
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className={`w-4 h-4 mr-2 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'กำลัง Export...' : 'Export Excel'}
          </Button>
        </div>
      }
      loading={loading}
      error={!!error}
      onRetry={refetch}
    >
      <div className="space-y-6">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ค่าใช้จ่ายรวม</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                ฿{stats.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">จำนวนลิตรรวม</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalLiters.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ราคาเฉลี่ย/ลิตร</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                ฿{stats.averagePricePerLiter.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ประสิทธิภาพเฉลี่ย</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.averageEfficiency ? `${stats.averageEfficiency.toFixed(2)} km/L` : 'N/A'}
              </div>
            </Card>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fuel Trend Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              กราฟแสดงการใช้น้ำมันรายเดือน
            </h3>
            {trendLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-400">
                กำลังโหลด...
              </div>
            ) : fuelTrend && fuelTrend.labels && fuelTrend.labels.length > 0 && fuelTrend.costs && fuelTrend.costs.length > 0 ? (
              <div className="h-64">
                <Line
                  data={{
                    labels: fuelTrend.labels,
                    datasets: [
                      {
                        label: 'ค่าใช้จ่าย (฿)',
                        data: fuelTrend.costs,
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y',
                      },
                      {
                        label: 'จำนวนลิตร (L)',
                        data: fuelTrend.liters,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      mode: 'index' as const,
                      intersect: false,
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top' as const,
                        labels: {
                          color: '#64748b',
                        },
                      },
                      tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: '#64748b' },
                      },
                      y: {
                        type: 'linear' as const,
                        display: true,
                        position: 'left' as const,
                        title: {
                          display: true,
                          text: 'ค่าใช้จ่าย (฿)',
                          color: '#64748b',
                        },
                        grid: {
                          color: '#e2e8f0',
                        },
                        ticks: { color: '#64748b' },
                      },
                      y1: {
                        type: 'linear' as const,
                        display: true,
                        position: 'right' as const,
                        title: {
                          display: true,
                          text: 'จำนวนลิตร (L)',
                          color: '#64748b',
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                        ticks: { color: '#64748b' },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                ไม่มีข้อมูลการใช้น้ำมันใน 6 เดือนล่าสุด
              </div>
            )}
          </Card>

          {/* Vehicle Fuel Cost Comparison Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              เปรียบเทียบค่าใช้จ่ายน้ำมันแต่ละรถ
            </h3>
            {comparisonLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-400">
                กำลังโหลด...
              </div>
            ) : vehicleFuelComparison && vehicleFuelComparison.length > 0 ? (
              <div className="h-64">
                <Bar
                  data={{
                    labels: vehicleFuelComparison.map(v => v.plate),
                    datasets: [
                      {
                        label: 'ค่าใช้จ่าย (฿)',
                        data: vehicleFuelComparison.map(v => v.totalCost),
                        backgroundColor: '#7c3aed',
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        callbacks: {
                          label: function (context) {
                            const vehicle = vehicleFuelComparison[context.dataIndex];
                            return [
                              `ค่าใช้จ่าย: ฿${vehicle.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                              `จำนวนลิตร: ${vehicle.totalLiters.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`,
                              `ประสิทธิภาพ: ${vehicle.averageEfficiency ? vehicle.averageEfficiency.toFixed(2) : 'N/A'} km/L`,
                            ];
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: {
                          color: '#64748b',
                          maxRotation: 45,
                          minRotation: 45,
                        },
                      },
                      y: {
                        grid: {
                          color: '#e2e8f0',
                        },
                        ticks: {
                          color: '#64748b',
                          callback: function (value) {
                            return '฿' + Number(value).toLocaleString('th-TH');
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Truck className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">ไม่มีข้อมูลการเปรียบเทียบค่าใช้จ่ายน้ำมันแต่ละรถ</p>
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-500">
                  {vehicleFuelComparison ? `พบ ${vehicleFuelComparison.length} รายการ แต่ไม่มีข้อมูลค่าใช้จ่าย` : 'กำลังโหลดข้อมูล...'}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Vehicle Efficiency Table */}
        {vehicleEfficiency && vehicleEfficiency.length > 0 && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                ประสิทธิภาพการใช้น้ำมันแต่ละรถ (6 เดือนล่าสุด)
              </h3>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                เรียงตามประสิทธิภาพ (km/L)
              </div>
            </div>
            {efficiencyLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : vehicleEfficiency.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">อันดับ</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทะเบียน</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สาขา</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ยี่ห้อ/รุ่น</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ประสิทธิภาพ (km/L)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทางรวม (km)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนลิตร</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ค่าใช้จ่าย (฿)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนครั้ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleEfficiency.map((vehicle, index) => (
                      <tr
                        key={vehicle.vehicle_id}
                        className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${index === 0 ? 'bg-green-50 dark:bg-green-900/10' : ''
                          }`}
                      >
                        <td className="py-3 px-4">
                          {index === 0 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold text-sm">
                              1
                            </span>
                          ) : index === 1 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm">
                              2
                            </span>
                          ) : index === 2 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500 text-white font-bold text-sm">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400 font-medium">
                              {index + 1}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                          {vehicle.plate}
                        </td>
                        <td className="py-3 px-4">
                          {(() => {
                            const vehicleData = vehicles.find(v => v.id === vehicle.vehicle_id);
                            return vehicleData?.branch ? (
                              <span className="inline-flex items-center px-2 py-1 bg-enterprise-100 dark:bg-enterprise-900 text-enterprise-700 dark:text-enterprise-300 rounded text-xs font-medium">
                                {vehicleData.branch}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-sm">-</span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-bold text-lg ${index === 0 ? 'text-green-600 dark:text-green-400' :
                            index === 1 ? 'text-blue-600 dark:text-blue-400' :
                              index === 2 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-slate-900 dark:text-slate-100'
                            }`}>
                            {vehicle.average_efficiency ? vehicle.average_efficiency.toFixed(2) : '-'}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">km/L</span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                          {vehicle.total_distance.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                          {vehicle.total_liters.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                          ฿{vehicle.total_cost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                          {vehicle.fill_count} ครั้ง
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
        )}

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Branch Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                สาขา
              </label>
              <select
                value={filters.branch || ''}
                onChange={(e) => {
                  setFilters({ ...filters, branch: e.target.value || undefined, vehicle_id: undefined });
                }}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
              >
                <option value="">ทั้งหมด</option>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                รถ
              </label>
              <select
                value={filters.vehicle_id || ''}
                onChange={(e) => setFilters({ ...filters, vehicle_id: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
              >
                <option value="">ทั้งหมด</option>
                {filteredVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} {vehicle.make && vehicle.model && `(${vehicle.make} ${vehicle.model})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Fuel Type Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ประเภทน้ำมัน
              </label>
              <select
                value={filters.fuel_type || ''}
                onChange={(e) => setFilters({ ...filters, fuel_type: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
              >
                <option value="">ทั้งหมด</option>
                {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่เริ่มต้น
              </label>
              <Input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่สิ้นสุด
              </label>
              <Input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined })}
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({});
                  setCurrentPage(1);
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                ล้างตัวกรอง
              </Button>
            </div>
          </div>
        </Card>

        {/* Branch filter info */}
        {filters.branch && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            กำลังแสดงเฉพาะรถในสาขา: <span className="font-medium">{filters.branch}</span>
          </div>
        )}

        {/* Fuel Logs List */}
        {displayedTotalCount === 0 ? (
          <Card className="p-12 text-center">
            <Droplet className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
              ไม่พบข้อมูลการเติมน้ำมัน
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {Object.keys(filters).length > 0
                ? 'ลองเปลี่ยนเงื่อนไขการค้นหา'
                : onCreate
                  ? 'เริ่มต้นด้วยการบันทึกการเติมน้ำมัน'
                  : 'ยังไม่มีข้อมูลการเติมน้ำมัน'}
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {displayedFuelLogs.map((record) => {
                const vehicle = vehicles.find(v => v.id === record.vehicle_id);
                return (
                  <Card key={record.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {(record as any).vehicle?.image_url ? (
                            <img
                              src={(record as any).vehicle.image_url}
                              alt={(record as any).vehicle.plate || 'Vehicle'}
                              className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-enterprise-500 transition-all"
                              onClick={() => {
                                setSelectedVehicleImage({
                                  url: (record as any).vehicle.image_url,
                                  alt: (record as any).vehicle.plate || 'Vehicle'
                                });
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`p-2 bg-enterprise-100 dark:bg-enterprise-900 rounded-lg ${(record as any).vehicle?.image_url ? 'hidden' : ''
                              }`}
                          >
                            <Droplet className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                              {vehicle?.plate || (record as any).vehicle?.plate || 'N/A'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {vehicle?.branch || (record as any).vehicle?.branch ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="px-2 py-0.5 bg-enterprise-100 dark:bg-enterprise-900 text-enterprise-700 dark:text-enterprise-300 rounded text-xs font-medium">
                                    {vehicle?.branch || (record as any).vehicle?.branch}
                                  </span>
                                  <span>•</span>
                                </span>
                              ) : null}
                              {FUEL_TYPE_LABELS[record.fuel_type] || record.fuel_type} • {formatDateOnly(record.filled_at)}
                            </p>
                          </div>
                        </div>

                        <div className="absolute top-6 right-6 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditFuelRecordId(record.id)}
                            className="flex items-center gap-1"
                          >
                            <Edit2 size={16} />
                            แก้ไขข้อมูล
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <Gauge size={14} />
                              เลขไมล์
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {record.odometer.toLocaleString()} km
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <Droplet size={14} />
                              จำนวนลิตร
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {Number(record.liters).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <DollarSign size={14} />
                              ราคา/ลิตร
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              ฿{Number(record.price_per_liter).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <DollarSign size={14} />
                              รวมเป็นเงิน
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white text-lg">
                              ฿{Number(record.total_cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <User size={14} />
                              เติมโดย
                            </p>
                            <div className="flex items-center gap-2">
                              {(record as any).user?.avatar_url ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedImage({
                                    src: (record as any).user.avatar_url,
                                    alt: (record as any).user?.full_name || 'User'
                                  })}
                                  className="cursor-pointer hover:opacity-80 transition-opacity"
                                  title="คลิกเพื่อดูรูปขนาดเต็ม"
                                >
                                  <Avatar
                                    src={(record as any).user?.avatar_url}
                                    alt={(record as any).user?.full_name || 'User'}
                                    size="sm"
                                    fallback={(record as any).user?.full_name || (record as any).user?.email}
                                  />
                                </button>
                              ) : (
                                <Avatar
                                  src={(record as any).user?.avatar_url}
                                  alt={(record as any).user?.full_name || 'User'}
                                  size="sm"
                                  fallback={(record as any).user?.full_name || (record as any).user?.email}
                                />
                              )}
                              <p className="font-medium text-slate-900 dark:text-white">
                                {(record as any).user?.full_name || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Fuel Efficiency */}
                        {record.fuel_efficiency && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <span className="font-medium">ประสิทธิภาพ:</span> {Number(record.fuel_efficiency).toFixed(2)} km/L
                              {record.distance_since_last_fill && (
                                <span className="ml-2">
                                  (ระยะทาง: {record.distance_since_last_fill.toLocaleString()} km)
                                </span>
                              )}
                            </p>
                          </div>
                        )}

                        {/* Additional Info */}
                        {(record.fuel_station || record.receipt_number || record.notes) && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {record.fuel_station && (
                              <div>
                                <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                  <MapPin size={14} />
                                  ปั๊มน้ำมัน
                                </p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {record.fuel_station}
                                </p>
                                {record.fuel_station_location && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    {record.fuel_station_location}
                                  </p>
                                )}
                              </div>
                            )}

                            {record.receipt_number && (
                              <div>
                                <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                  <FileText size={14} />
                                  เลขที่ใบเสร็จ
                                </p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {record.receipt_number}
                                </p>
                              </div>
                            )}

                            {record.notes && (
                              <div>
                                <p className="text-slate-500 dark:text-slate-400 mb-1">หมายเหตุ</p>
                                <p className="text-slate-900 dark:text-white">
                                  {record.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Receipt Image */}
                        {record.receipt_image_url && (
                          <div className="mt-3">
                            <a
                              href={record.receipt_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-enterprise-600 dark:text-enterprise-400 hover:underline"
                            >
                              <FileText size={14} />
                              ดูรูปใบเสร็จ
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(record.filled_at)}
                        </div>
                        {record.is_full_tank && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                            เติมเต็มถัง
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Card className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    แสดง {startIndex + 1}-{endIndex} จาก {totalCount.toLocaleString('th-TH')} รายการ
                    {totalPages > 1 && (
                      <span className="ml-2">(ทั้งหมด {totalPages.toLocaleString('th-TH')} หน้า)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft size={16} />
                      ก่อนหน้า
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {(() => {
                        const pages: (number | string)[] = [];

                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          pages.push(1);

                          const startPage = Math.max(2, currentPage - 2);
                          const endPage = Math.min(totalPages - 1, currentPage + 2);

                          if (startPage > 2) {
                            pages.push('ellipsis-start');
                          }

                          for (let i = startPage; i <= endPage; i++) {
                            if (i !== 1 && i !== totalPages) {
                              pages.push(i);
                            }
                          }

                          if (endPage < totalPages - 1) {
                            pages.push('ellipsis-end');
                          }

                          pages.push(totalPages);
                        }

                        return pages.map((page) => {
                          if (typeof page === 'string') {
                            return (
                              <span key={page} className="px-2 text-slate-400">
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                                ? 'bg-enterprise-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                              {page.toLocaleString('th-TH')}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Jump to Page Input */}
                    {totalPages > 10 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">ไปที่หน้า:</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const page = parseInt(pageInput);
                              if (page >= 1 && page <= totalPages) {
                                setCurrentPage(page);
                                setPageInput('');
                              }
                            }
                          }}
                          placeholder={`1-${totalPages}`}
                          className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const page = parseInt(pageInput);
                            if (page >= 1 && page <= totalPages) {
                              setCurrentPage(page);
                              setPageInput('');
                            }
                          }}
                          disabled={!pageInput || parseInt(pageInput) < 1 || parseInt(pageInput) > totalPages}
                        >
                          ไป
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      ถัดไป
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Expanded Image Modal for User Avatar */}
      <ImageModal
        isOpen={!!expandedImage}
        imageUrl={expandedImage?.src || ''}
        alt={expandedImage?.alt || ''}
        onClose={() => setExpandedImage(null)}
      />

      {/* Vehicle Image Modal */}
      <ImageModal
        isOpen={!!selectedVehicleImage}
        imageUrl={selectedVehicleImage?.url || ''}
        alt={selectedVehicleImage?.alt || ''}
        onClose={() => setSelectedVehicleImage(null)}
      />
    </PageLayout>
  );
};

