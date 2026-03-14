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
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useVehicles } from '../../hooks/useVehicles';
import { useVehicleTripUsageReport } from '../../hooks/useVehicleTripUsageReport';
import { TripProductSummarySection } from '../../components/trip/TripProductSummarySection';
import { TripStaffItemDistributionSection } from '../../components/trip/TripStaffItemDistributionSection';
import { ProductSummaryChart } from '../../components/trip/ProductSummaryChart';
import type { VehicleTripDailySummary, VehicleTripDetail } from '../../services/vehicleTripUsageService';

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

  const { dailySummaries, productSummary, loading, productSummaryLoading, error, refetch } =
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
  const activeDays = dailySummaries.length;

  const selectedVehicle = vehicles.find((v) => v.id === searchedVehicleId);

  const maxDate = new Date().toISOString().split('T')[0];

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
          {/* Summary Cards */}
          {dailySummaries.length > 0 && (
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
          )}

          {/* สรุปสินค้าที่บรรทุก: กราฟอยู่บนสุด รายการตารางซ่อนไว้กดดู */}
          {(productSummaryLoading || productSummary.length > 0) && (
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

          {/* Daily Table — แบ่งหน้าและจัดระเบียบ */}
          {dailySummaries.length > 0 ? (
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
