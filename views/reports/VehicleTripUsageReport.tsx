// VehicleTripUsageReport.tsx
// รายงานการใช้รถละเอียด — แสดงตารางสรุปรายวันต่อรถคัน พร้อม modal ทริป/สินค้า/พนักงาน
import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  Route,
  RefreshCw,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Package,
  Users,
  X,
  DollarSign,
  Droplet,
  TrendingUp,
  Download,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { excelExport } from '../../utils/excelExport';
import { useVehicles } from '../../hooks/useVehicles';
import { useVehicleTripUsageReport } from '../../hooks/useVehicleTripUsageReport';
import { TripProductSummarySection } from '../../components/trip/TripProductSummarySection';
import { TripStaffItemDistributionSection } from '../../components/trip/TripStaffItemDistributionSection';
import { ProductSummaryChart } from '../../components/trip/ProductSummaryChart';
import { MonthlyCostChart } from '../../components/trip/MonthlyCostChart';
import { vehicleTripUsageService, type VehicleTripDailySummary, type VehicleTripDetail } from '../../services/vehicleTripUsageService';

interface VehicleTripUsageReportProps {
  isDark?: boolean;
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function getDefaultDateRange() {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const start14 = new Date(today);
  start14.setDate(start14.getDate() - 13);
  const start = start14.toISOString().split('T')[0];
  return { start, end };
}

function formatThaiDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00+07:00');
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatThaiTime(isoStr: string | null) {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

function formatMonthThai(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

type DetailTab = 'products' | 'staff';

// ─────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────

interface DayModalProps {
  daySummary: VehicleTripDailySummary;
  isDark: boolean;
  onClose: () => void;
}

const DayTripsModal: React.FC<DayModalProps> = ({ daySummary, isDark, onClose }) => {
  const [selectedTrip, setSelectedTrip] = useState<VehicleTripDetail | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('products');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className={`max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col ${isDark ? 'dark' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Route className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
              ทริปของวัน: {formatThaiDate(daySummary.date)}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {daySummary.trip_count} ทริป · {daySummary.total_distance_km.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} กม.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="flex items-center gap-1">
            <X size={14} />
            ปิด
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Trip list */}
          <div className="px-6 py-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                      เลขทริป
                    </th>
                    <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                      เวลาออก
                    </th>
                    <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                      เวลากลับ
                    </th>
                    <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                      คนขับ
                    </th>
                    <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                      ระยะทาง (กม.)
                    </th>
                    <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      ปลายทาง / เส้นทาง
                    </th>
                    <th className="text-center py-2 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                      รายละเอียด
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {daySummary.trips.map((trip) => {
                    const isSelected = selectedTrip?.trip_log_id === trip.trip_log_id;
                    return (
                      <React.Fragment key={trip.trip_log_id}>
                        <tr
                          className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${
                            isSelected
                              ? 'bg-enterprise-50 dark:bg-enterprise-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2 px-3 whitespace-nowrap">
                            {trip.trip_number ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-enterprise-600 dark:text-enterprise-400 bg-enterprise-50 dark:bg-enterprise-900/30 px-2 py-0.5 rounded">
                                <Package size={10} />
                                {trip.trip_number}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 text-xs">ไม่ใช่ delivery</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {formatThaiTime(trip.checkout_time)}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {formatThaiTime(trip.checkin_time)}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {trip.driver_name}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {trip.distance_km !== null
                              ? `${trip.distance_km.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}${trip.is_manual_distance ? '*' : ''}`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-xs max-w-[160px] truncate">
                            {trip.destination || trip.route || trip.notes || '-'}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {trip.delivery_trip_id ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedTrip(null);
                                  } else {
                                    setSelectedTrip(trip);
                                    setDetailTab('products');
                                  }
                                }}
                                className="flex items-center gap-1 text-xs"
                              >
                                {isSelected ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {isSelected ? 'ซ่อน' : 'ดูสินค้า/พนักงาน'}
                              </Button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 text-xs">-</span>
                            )}
                          </td>
                        </tr>

                        {/* Expandable detail row */}
                        {isSelected && trip.delivery_trip_id && (
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <td colSpan={7} className="px-3 py-0">
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg my-2 overflow-hidden">
                                {/* Tabs */}
                                <div className="flex border-b border-slate-200 dark:border-slate-700 px-4 pt-3">
                                  <button
                                    onClick={() => setDetailTab('products')}
                                    className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                      detailTab === 'products'
                                        ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    <Package size={14} />
                                    สินค้า
                                  </button>
                                  <button
                                    onClick={() => setDetailTab('staff')}
                                    className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                      detailTab === 'staff'
                                        ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    <Users size={14} />
                                    แบ่งของพนักงาน
                                  </button>
                                </div>
                                <div className="p-4">
                                  {detailTab === 'products' ? (
                                    <TripProductSummarySection
                                      tripId={trip.delivery_trip_id}
                                      isDark={isDark}
                                    />
                                  ) : (
                                    <TripStaffItemDistributionSection
                                      tripId={trip.delivery_trip_id}
                                      isDark={isDark}
                                    />
                                  )}
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
            {/* Footnote for manual distance */}
            {daySummary.trips.some((t) => t.is_manual_distance) && (
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-2">
                * ระยะทางระบุเอง (เลขไมล์เสีย)
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────
// Main View
// ─────────────────────────────────────────────────

export const VehicleTripUsageReport: React.FC<VehicleTripUsageReportProps> = ({
  isDark = false,
}) => {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);

  const { vehicles, loading: vehiclesLoading } = useVehicles();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  // เก็บ params ที่ใช้จริง (เมื่อกดค้นหา)
  const [searchedVehicleId, setSearchedVehicleId] = useState<string | null>(null);
  const [searchedStart, setSearchedStart] = useState(defaultRange.start);
  const [searchedEnd, setSearchedEnd] = useState(defaultRange.end);

  const [selectedDay, setSelectedDay] = useState<VehicleTripDailySummary | null>(null);
  const [dailyTablePage, setDailyTablePage] = useState(1);
  const [dailyTablePerPage, setDailyTablePerPage] = useState(20);
  const [showProductTable, setShowProductTable] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  const { dailySummaries, productSummary, costSummary, financialSummary, monthlySummaries, loading, productSummaryLoading, error, refetch } =
    useVehicleTripUsageReport({
      vehicleId: searchedVehicleId,
      startDate: searchedStart,
      endDate: searchedEnd,
    });

  const handleSearch = () => {
    if (!selectedVehicleId) return;
    setSearchedVehicleId(selectedVehicleId);
    setSearchedStart(startDate);
    setSearchedEnd(endDate);
  };

  // รีเซ็ตไปหน้า 1 เมื่อผลการค้นหาเปลี่ยน
  useEffect(() => {
    setDailyTablePage(1);
  }, [dailySummaries.length, searchedVehicleId, searchedStart, searchedEnd]);

  // Pagination สำหรับตารางสรุปรายวัน
  const dailyTotal = dailySummaries.length;
  const dailyTotalPages = Math.max(1, Math.ceil(dailyTotal / dailyTablePerPage));
  const dailyPageSafe = Math.min(Math.max(1, dailyTablePage), dailyTotalPages);
  const dailyStartIndex = (dailyPageSafe - 1) * dailyTablePerPage;
  const dailyEndIndex = Math.min(dailyStartIndex + dailyTablePerPage, dailyTotal);
  const paginatedDaily = useMemo(
    () => dailySummaries.slice(dailyStartIndex, dailyEndIndex),
    [dailySummaries, dailyStartIndex, dailyEndIndex]
  );

  // ซิงค์หมายเลขหน้าเมื่อจำนวนหน้าลด (เช่น เปลี่ยน "แสดงต่อหน้า")
  useEffect(() => {
    if (dailyTotalPages > 0 && dailyTablePage > dailyTotalPages) {
      setDailyTablePage(dailyTotalPages);
    }
  }, [dailyTotalPages, dailyTablePage]);

  // Aggregate stats
  const totalTrips = useMemo(() => dailySummaries.reduce((s, d) => s + d.trip_count, 0), [dailySummaries]);
  const totalDistance = useMemo(() => dailySummaries.reduce((s, d) => s + d.total_distance_km, 0), [dailySummaries]);
  const totalPieces = useMemo(
    () => productSummary.reduce((s, p) => s + p.total_quantity, 0),
    [productSummary]
  );
  const activeDays = dailySummaries.length;

  // ตัวชี้ความคุ้มค่า (ต้นทุนต่อทริป/กม./ชิ้น)
  const costPerTrip =
    costSummary && totalTrips > 0 ? costSummary.total_cost / totalTrips : null;
  const costPerKm =
    costSummary && totalDistance > 0 ? costSummary.total_cost / totalDistance : null;
  const costPerPiece =
    costSummary && totalPieces > 0 ? costSummary.total_cost / totalPieces : null;

  const selectedVehicle = vehicles.find((v) => v.id === searchedVehicleId);

  const maxDate = new Date().toISOString().split('T')[0];

  const [exporting, setExporting] = useState(false);
  const handleExportExcel = async () => {
    if (!searchedVehicleId) return;
    setExporting(true);
    try {
      const summaryRow = {
        totalTrips,
        totalDistance,
        activeDays,
        fuel_cost: costSummary?.fuel_cost ?? 0,
        commission_cost: costSummary?.commission_cost ?? 0,
        total_cost: costSummary?.total_cost ?? 0,
      };
      const dailyRows = dailySummaries.map((d) => ({
        date: d.date,
        trip_count: d.trip_count,
        total_distance_km: d.total_distance_km,
        drivers: d.drivers.join('; '),
      }));
      const monthlyRows = monthlySummaries.map((m) => ({
        month: m.month,
        trip_count: m.trip_count,
        total_distance_km: m.total_distance_km,
        fuel_cost: m.fuel_cost,
        commission_cost: m.commission_cost,
        total_cost: m.total_cost,
      }));

      const tripListRows = dailySummaries.flatMap((d) =>
        d.trips.map((t) => ({
          date: d.date,
          trip_number: t.trip_number ?? '-',
          driver_name: t.driver_name,
          distance_km: t.distance_km ?? 0,
        }))
      );

      const productRows = productSummary.map((p) => ({
        product_code: p.product_code,
        product_name: p.product_name,
        category: p.category,
        unit: p.unit,
        total_quantity: p.total_quantity,
      }));

      const tripStoresRows = await vehicleTripUsageService.getVehicleTripStoresForExport({
        vehicleId: searchedVehicleId,
        startDate: searchedStart,
        endDate: searchedEnd,
      });

      const sheets: { sheetName: string; data: Record<string, unknown>[]; columns: { key: string; label: string; width?: number; format?: (v: unknown) => string | number }[] }[] = [
        {
          sheetName: 'สรุปช่วง',
          data: [summaryRow],
          columns: [
            { key: 'totalTrips', label: 'ทริปทั้งหมด', width: 14, format: excelExport.formatNumber },
            { key: 'totalDistance', label: 'ระยะทางรวม (กม.)', width: 18, format: (v: number) => excelExport.formatNumber(v, 1) },
            { key: 'activeDays', label: 'วันที่มีใช้รถ', width: 16, format: excelExport.formatNumber },
            { key: 'fuel_cost', label: 'ค่าน้ำมัน (บาท)', width: 18, format: excelExport.formatCurrency },
            { key: 'commission_cost', label: 'ค่าคอม (บาท)', width: 18, format: excelExport.formatCurrency },
            { key: 'total_cost', label: 'ต้นทุนรวม (บาท)', width: 20, format: excelExport.formatCurrency },
          ],
        },
        {
          sheetName: 'รหัสทริป',
          data: tripListRows,
          columns: [
            { key: 'date', label: 'วันที่', width: 14 },
            { key: 'trip_number', label: 'รหัสทริป', width: 18 },
            { key: 'driver_name', label: 'คนขับ', width: 22 },
            { key: 'distance_km', label: 'ระยะทาง (กม.)', width: 16, format: (v: number) => excelExport.formatNumber(v, 1) },
          ],
        },
        {
          sheetName: 'สรุปสินค้า',
          data: productRows,
          columns: [
            { key: 'product_code', label: 'รหัสสินค้า', width: 16 },
            { key: 'product_name', label: 'ชื่อสินค้า', width: 28 },
            { key: 'category', label: 'หมวดหมู่', width: 16 },
            { key: 'unit', label: 'หน่วย', width: 10 },
            { key: 'total_quantity', label: 'จำนวนรวม (ชิ้น)', width: 18, format: excelExport.formatNumber },
          ],
        },
        {
          sheetName: 'ร้านค้าที่ไปส่ง',
          data: tripStoresRows.map((r) => ({
            trip_number: r.trip_number ?? '-',
            planned_date: r.planned_date,
            sequence_order: r.sequence_order,
            customer_code: r.customer_code ?? '-',
            customer_name: r.customer_name ?? '-',
          })),
          columns: [
            { key: 'trip_number', label: 'รหัสทริป', width: 18 },
            { key: 'planned_date', label: 'วันที่', width: 14 },
            { key: 'sequence_order', label: 'ลำดับ', width: 10, format: excelExport.formatNumber },
            { key: 'customer_code', label: 'รหัสร้าน', width: 14 },
            { key: 'customer_name', label: 'ชื่อร้าน', width: 28 },
          ],
        },
        {
          sheetName: 'สรุปรายวัน',
          data: dailyRows,
          columns: [
            { key: 'date', label: 'วันที่', width: 14 },
            { key: 'trip_count', label: 'จำนวนทริป', width: 14, format: excelExport.formatNumber },
            { key: 'total_distance_km', label: 'ระยะทาง (กม.)', width: 16, format: (v: number) => excelExport.formatNumber(v, 1) },
            { key: 'drivers', label: 'คนขับ', width: 28 },
          ],
        },
        {
          sheetName: 'สรุปรายเดือน',
          data: monthlyRows,
          columns: [
            { key: 'month', label: 'เดือน', width: 12 },
            { key: 'trip_count', label: 'จำนวนทริป', width: 14, format: excelExport.formatNumber },
            { key: 'total_distance_km', label: 'ระยะทาง (กม.)', width: 16, format: (v: number) => excelExport.formatNumber(v, 1) },
            { key: 'fuel_cost', label: 'ค่าน้ำมัน (บาท)', width: 18, format: excelExport.formatCurrency },
            { key: 'commission_cost', label: 'ค่าคอม (บาท)', width: 18, format: excelExport.formatCurrency },
            { key: 'total_cost', label: 'ต้นทุนรวม (บาท)', width: 20, format: excelExport.formatCurrency },
          ],
        },
      ];

      excelExport.exportToExcelMultiSheet(
        sheets,
        `รายงานการใช้รถ_${selectedVehicle?.plate ?? 'vehicle'}_${searchedStart}_${searchedEnd}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          {/* Vehicle selector */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              <Truck className="inline-block w-4 h-4 mr-1 text-slate-500 dark:text-slate-400" />
              เลือกรถ
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 text-sm min-w-[200px]"
              disabled={vehiclesLoading}
            >
              <option value="">-- เลือกรถ --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} {v.make && v.model ? `(${v.make} ${v.model})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="inline-block w-4 h-4 mr-1 text-slate-500 dark:text-slate-400" />
              ช่วงวันที่
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 text-sm"
              />
              <span className="text-slate-500 dark:text-slate-400 text-sm">ถึง</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={maxDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 text-sm"
              />
            </div>
          </div>

          {/* Search button */}
          <Button
            onClick={handleSearch}
            disabled={!selectedVehicleId || loading}
            className="flex items-center gap-2 self-end"
          >
            <Search size={16} />
            ค้นหา
          </Button>

          {searchedVehicleId && (
            <Button
              onClick={refetch}
              variant="outline"
              disabled={loading}
              className="flex items-center gap-2 self-end"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              รีเฟรช
            </Button>
          )}
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-slate-500 dark:text-slate-400">
          <RefreshCw size={20} className="animate-spin" />
          <span>กำลังโหลดข้อมูล...</span>
        </div>
      )}

      {/* Results */}
      {!loading && searchedVehicleId && (
        <>
          {/* View mode: ช่วงวันที่ | รายเดือน + Export */}
          {(dailySummaries.length > 0 || monthlySummaries.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('daily')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'daily'
                      ? 'bg-enterprise-600 text-white dark:bg-enterprise-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  ช่วงวันที่
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'monthly'
                      ? 'bg-enterprise-600 text-white dark:bg-enterprise-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  รายเดือน
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exporting}
                className="gap-2"
              >
                <Download size={16} className={exporting ? 'animate-pulse' : ''} />
                {exporting ? 'กำลัง export...' : 'Export Excel'}
              </Button>
            </div>
          )}

          {/* Summary Cards — แสดงเมื่อโหมดรายวัน และมีข้อมูลรายวัน */}
          {viewMode === 'daily' && dailySummaries.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ทริปทั้งหมด</p>
                      <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalTrips}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">ในช่วงที่เลือก</p>
                    </div>
                    <div className="p-3 bg-enterprise-100 dark:bg-enterprise-900/30 rounded-lg">
                      <Route className="text-enterprise-600 dark:text-enterprise-400" size={22} />
                    </div>
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ระยะทางรวม</p>
                      <p className="text-3xl font-bold text-slate-900 dark:text-white">
                        {totalDistance.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">กิโลเมตร</p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Truck className="text-blue-600 dark:text-blue-400" size={22} />
                    </div>
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">วันที่มีการใช้รถ</p>
                      <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeDays}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">วัน</p>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Calendar className="text-green-600 dark:text-green-400" size={22} />
                    </div>
                  </div>
                </Card>
              </div>

              {/* ต้นทุน: ค่าน้ำมัน, ค่าคอม, ต้นทุนรวม */}
              {costSummary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ค่าน้ำมันรวม</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          ฿{costSummary.fuel_cost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">ในช่วงที่เลือก</p>
                      </div>
                      <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                        <Droplet className="text-amber-600 dark:text-amber-400" size={22} />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ค่าคอมรวม</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          ฿{costSummary.commission_cost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">ในช่วงที่เลือก</p>
                      </div>
                      <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                        <Users className="text-violet-600 dark:text-violet-400" size={22} />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ต้นทุนรวม</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          ฿{costSummary.total_cost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">น้ำมัน + ค่าคอม</p>
                      </div>
                      <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                        <DollarSign className="text-slate-600 dark:text-slate-300" size={22} />
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* รายได้และกำไร/ขาดทุน (Phase 3 — ซ่อนไว้ก่อน) */}
              {false && financialSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">รายได้รวม</p>
                        {financialSummary.has_revenue_data ? (
                          <>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              ฿{financialSummary.revenue.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">จากออเดอร์ที่ผูกทริปในช่วงที่เลือก</p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-medium text-slate-500 dark:text-slate-400">—</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">รายได้จะแสดงเมื่อมีออเดอร์ผูกกับทริป</p>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                  <Card className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">กำไร / ขาดทุน</p>
                        {financialSummary.has_revenue_data ? (
                          <>
                            <p
                              className={`text-2xl font-bold ${
                                financialSummary.profit >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {financialSummary.profit >= 0 ? '' : '−'}฿
                              {Math.abs(financialSummary.profit).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              {financialSummary.revenue > 0
                                ? `ประมาณ ${((financialSummary.profit / financialSummary.revenue) * 100).toFixed(1)}% ของรายได้`
                                : financialSummary.profit >= 0 ? 'กำไร' : 'ขาดทุน'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-medium text-slate-500 dark:text-slate-400">—</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">กำไร/ขาดทุนจะแสดงเมื่อมีข้อมูลรายได้</p>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* ตัวชี้ความคุ้มค่า */}
              {costSummary && costSummary.total_cost > 0 && (totalTrips > 0 || totalDistance > 0 || totalPieces > 0) && (
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <TrendingUp size={18} className="text-enterprise-600 dark:text-enterprise-400" />
                    ตัวชี้ความคุ้มค่า
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {costPerTrip !== null && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ต้นทุนต่อทริป</p>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          ฿{costPerTrip.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-slate-500 dark:text-slate-400 text-sm font-normal">/ ทริป</span>
                        </p>
                      </div>
                    )}
                    {costPerKm !== null && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ต้นทุนต่อกม.</p>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          ฿{costPerKm.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-slate-500 dark:text-slate-400 text-sm font-normal">/ กม.</span>
                        </p>
                      </div>
                    )}
                    {costPerPiece !== null && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ต้นทุนต่อชิ้นส่ง</p>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          ฿{costPerPiece.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-slate-500 dark:text-slate-400 text-sm font-normal">/ ชิ้น</span>
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* สรุปสินค้าที่บรรทุก — แสดงเฉพาะโหมดรายวัน */}
          {viewMode === 'daily' && (productSummaryLoading || productSummary.length > 0) && (
            <Card>
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <Package className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400 shrink-0" />
                  สรุปสินค้าที่บรรทุกในช่วงที่เลือก
                  {selectedVehicle && (
                    <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                      — {selectedVehicle.plate}
                    </span>
                  )}
                  {productSummaryLoading && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <RefreshCw size={14} className="animate-spin" />
                      กำลังโหลด...
                    </span>
                  )}
                </h3>
                {!productSummaryLoading && productSummary.length > 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    รวมทุกทริปในวันที่กรอง · {productSummary.length} ชนิดสินค้า ·{' '}
                    {productSummary.reduce((s, p) => s + p.total_quantity, 0).toLocaleString('th-TH')} ชิ้นรวม
                  </p>
                )}
              </div>

              {productSummaryLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                  <RefreshCw size={20} className="animate-spin mr-2" />
                  กำลังโหลดสรุปสินค้า...
                </div>
              ) : (
                <>
                  {/* กราฟอยู่บนสุด — ดูภาพรวมได้ทันที */}
                  <div className="px-6 py-4">
                    <ProductSummaryChart
                      data={productSummary}
                      isDark={isDark}
                      productBarLimit={15}
                    />
                  </div>

                  {/* รายการตาราง: ซ่อนไว้ กดถึงแสดง */}
                  <div className="border-t border-slate-200 dark:border-slate-700">
                    <div className="px-6 py-3 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        รายการสินค้าแบบตาราง
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowProductTable((v) => !v)}
                        className="gap-1.5"
                      >
                        {showProductTable ? (
                          <>
                            <ChevronUp size={14} />
                            ซ่อนรายการ
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            ดูรายการ ({productSummary.length} รายการ)
                          </>
                        )}
                      </Button>
                    </div>
                    {showProductTable && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                รหัสสินค้า
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                ชื่อสินค้า
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                หมวดหมู่
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                หน่วย
                              </th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                จำนวนรวม (ชิ้น)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {productSummary.map((row, index) => (
                              <tr
                                key={row.product_id}
                                className={`border-b border-slate-100 dark:border-slate-800 ${
                                  index % 2 === 0
                                    ? 'bg-white dark:bg-slate-900'
                                    : 'bg-slate-50/60 dark:bg-slate-900/60'
                                }`}
                              >
                                <td className="py-3 px-4 text-slate-800 dark:text-slate-100 font-medium">
                                  {row.product_code || '-'}
                                </td>
                                <td className="py-3 px-4 text-slate-800 dark:text-slate-100">
                                  {row.product_name || '-'}
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-sm">
                                  {row.category || '-'}
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-sm">
                                  {row.unit || '-'}
                                </td>
                                <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
                                  {row.total_quantity.toLocaleString('th-TH')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* โหมดรายเดือน: กราฟต้นทุน + ตารางสรุปรายเดือน */}
          {viewMode === 'monthly' && monthlySummaries.length > 0 && (
            <>
              <Card>
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    ต้นทุนรายเดือน
                    {selectedVehicle && (
                      <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                        — {selectedVehicle.plate}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    ค่าน้ำมัน + ค่าคอม แยกตามเดือน
                  </p>
                </div>
                <div className="px-6 py-4">
                  <MonthlyCostChart data={monthlySummaries} isDark={isDark} />
                </div>
              </Card>
              <Card>
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    สรุปรายเดือน
                    {selectedVehicle && (
                      <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                        — {selectedVehicle.plate}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    จำนวนทริป, ระยะทาง, ต้นทุน แยกตามเดือน
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          เดือน
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          จำนวนทริป
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          ระยะทาง (กม.)
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          ค่าน้ำมัน (บาท)
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          ค่าคอม (บาท)
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          ต้นทุนรวม (บาท)
                        </th>
                        {/* รายได้/กำไร — ซ่อนไว้ก่อน */}
                        {false && (
                          <>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              รายได้ (บาท)
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              กำไร/ขาดทุน (บาท)
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummaries.map((row, index) => (
                        <tr
                          key={row.month}
                          className={`border-b border-slate-100 dark:border-slate-800 ${
                            index % 2 === 0
                              ? 'bg-white dark:bg-slate-900'
                              : 'bg-slate-50/50 dark:bg-slate-900/50'
                          }`}
                        >
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium whitespace-nowrap">
                            {formatMonthThai(row.month)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 tabular-nums">
                            {row.trip_count}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 tabular-nums">
                            {row.total_distance_km > 0
                              ? row.total_distance_km.toLocaleString('th-TH', {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 1,
                                })
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 tabular-nums">
                            ฿{row.fuel_cost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 tabular-nums">
                            ฿{row.commission_cost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
                            ฿{row.total_cost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* Daily Table — แสดงเฉพาะโหมดรายวัน */}
          {viewMode === 'daily' && dailySummaries.length > 0 ? (
            <Card>
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      สรุปการใช้รถรายวัน
                      {selectedVehicle && (
                        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                          — {selectedVehicle.plate}
                          {selectedVehicle.make && selectedVehicle.model
                            ? ` (${selectedVehicle.make} ${selectedVehicle.model})`
                            : ''}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      รวม {dailyTotal.toLocaleString('th-TH')} วันในช่วงที่เลือก
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      แสดงต่อหน้า
                      <select
                        value={dailyTablePerPage}
                        onChange={(e) => {
                          setDailyTablePerPage(Number(e.target.value));
                          setDailyTablePage(1);
                        }}
                        className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        วันที่
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        จำนวนทริป
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        ระยะทางรวม (กม.)
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">
                        คนขับ
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        รายละเอียด
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDaily.map((day, index) => (
                      <tr
                        key={day.date}
                        className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                          index % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/50 dark:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium whitespace-nowrap">
                          {formatThaiDate(day.date)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 tabular-nums">
                          {day.trip_count}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
                          {day.total_distance_km > 0
                            ? day.total_distance_km.toLocaleString('th-TH', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              })
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-sm max-w-[200px] truncate" title={day.drivers.join('; ')}>
                          {day.drivers.length > 0 ? day.drivers.join('; ') : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDay(day)}
                            className="flex items-center gap-1 mx-auto"
                          >
                            <Route size={13} />
                            ดูทริปของวันนี้
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {dailyTotalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 order-2 sm:order-1">
                    แสดง {dailyStartIndex + 1}-{dailyEndIndex} จาก {dailyTotal.toLocaleString('th-TH')} รายการ
                    <span className="ml-1 text-slate-500 dark:text-slate-500">
                      (หน้า {dailyPageSafe} / {dailyTotalPages.toLocaleString('th-TH')})
                    </span>
                  </p>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDailyTablePage((p) => Math.max(1, p - 1))}
                      disabled={dailyPageSafe <= 1}
                      className="gap-1"
                    >
                      <ChevronLeft size={16} />
                      ก่อนหน้า
                    </Button>
                    <span className="px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[4rem] text-center">
                      {dailyPageSafe} / {dailyTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDailyTablePage((p) => Math.min(dailyTotalPages, p + 1))}
                      disabled={dailyPageSafe >= dailyTotalPages}
                      className="gap-1"
                    >
                      ถัดไป
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : viewMode === 'monthly' && monthlySummaries.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-14 text-slate-500 dark:text-slate-400">
                <Calendar size={48} className="mb-3 text-slate-300 dark:text-slate-700" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
                  ไม่มีข้อมูลสรุปรายเดือนในช่วงที่เลือก
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-600 mt-1">
                  ลองขยายช่วงวันที่หรือเลือกรถอื่น
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col items-center justify-center py-14 text-slate-500 dark:text-slate-400">
                <Truck size={48} className="mb-3 text-slate-300 dark:text-slate-700" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
                  ไม่มีข้อมูลการใช้รถในช่วงเวลาที่เลือก
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-600 mt-1">
                  กรุณาเลือกรถและช่วงวันที่ แล้วกด "ค้นหา" อีกครั้ง
                </p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Initial empty state (ยังไม่ได้ค้นหา) */}
      {!loading && !searchedVehicleId && (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-slate-500 dark:text-slate-400">
            <Search size={48} className="mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-base font-medium text-slate-600 dark:text-slate-400">
              เลือกรถและช่วงวันที่ แล้วกด "ค้นหา"
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-600 mt-1">
              เพื่อดูรายงานการใช้รถรายวันแบบละเอียด
            </p>
          </div>
        </Card>
      )}

      {/* Day Trips Modal */}
      {selectedDay && (
        <DayTripsModal
          daySummary={selectedDay}
          isDark={isDark}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
};
