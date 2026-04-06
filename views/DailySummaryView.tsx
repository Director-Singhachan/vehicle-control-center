// Daily Summary View - สรุปการใช้รถรายวัน
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Truck,
  Route,
  TrendingUp,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Users,
  Clock,
  Package,
} from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getBranchLabel } from '../utils/branchLabels';
import { dailySummaryService, type DailySummary, type DailyVehicleSummary } from '../services/dailySummaryService';
import { tripLogService, type TripLogWithRelations } from '../services/tripLogService';

interface DailySummaryViewProps {
  isDark?: boolean;
  onViewDeliveryTrip?: (deliveryTripId: string) => void;
}

export const DailySummaryView: React.FC<DailySummaryViewProps> = ({ isDark = false, onViewDeliveryTrip }) => {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<DailyVehicleSummary | null>(null);
  const [vehicleTrips, setVehicleTrips] = useState<TripLogWithRelations[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const fetchSummary = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await dailySummaryService.getDailySummary(date);
      setSummary(data);
    } catch (err) {
      console.error('[DailySummaryView] Error fetching summary:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handlePreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    const today = new Date().toISOString().split('T')[0];
    const nextDate = date.toISOString().split('T')[0];
    if (nextDate <= today) {
      setSelectedDate(nextDate);
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleViewVehicleTrips = async (vehicle: DailyVehicleSummary) => {
    setSelectedVehicle(vehicle);
    setLoadingTrips(true);
    setTripsError(null);
    setVehicleTrips([]);

    try {
      // ดึงทริปของรถคันนี้เฉพาะวันที่เลือก
      const start = `${selectedDate}T00:00:00.000Z`;
      const end = `${selectedDate}T23:59:59.999Z`;
      const result = await tripLogService.getTripHistory({
        vehicle_id: vehicle.vehicle_id,
        start_date: start,
        end_date: end,
      });
      setVehicleTrips(result.data);
    } catch (err) {
      console.error('[DailySummaryView] Error fetching vehicle trips:', err);
      setTripsError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายละเอียดทริปได้');
    } finally {
      setLoadingTrips(false);
    }
  };

  const branches = useMemo(() => {
    if (!summary) return [];
    const set = new Set<string>();
    summary.vehicles.forEach(v => {
      if (v.branch) set.add(v.branch);
    });
    return Array.from(set).sort();
  }, [summary]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const exportToCSV = () => {
    if (!summary || summary.vehicles.length === 0) return;

    const headers = ['ทะเบียนรถ', 'ยี่ห้อ/รุ่น', 'จำนวนทริป', 'ระยะทางรวม (กม.)', 'ไมล์เริ่มต้น', 'ไมล์สิ้นสุด', 'พนักงานที่ใช้รถ'];
    const rows = summary.vehicles.map(v => [
      v.vehicle_plate,
      v.vehicle_make && v.vehicle_model ? `${v.vehicle_make} ${v.vehicle_model}` : '-',
      v.trip_count.toString(),
      v.total_distance_km.toFixed(2),
      v.odometer_start !== null && v.odometer_start !== undefined ? v.odometer_start.toString() : '-',
      v.odometer_end !== null && v.odometer_end !== undefined ? v.odometer_end.toString() : '-',
      v.drivers && v.drivers.length > 0 ? v.drivers.join('; ') : '-',
    ]);

    const csvContent = [
      `สรุปการใช้รถรายวัน - ${formatDate(summary.date)}`,
      '',
      `ภาพรวม: ${summary.total_vehicles} คัน, ${summary.total_trips} ทริป, ${summary.total_distance_km.toFixed(2)} กิโลเมตร`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `สรุปการใช้รถ_${summary.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const maxDate = new Date().toISOString().split('T')[0];

  return (
    <PageLayout
      title="สรุปการใช้รถรายวัน"
      subtitle="ข้อมูลสรุปการใช้รถในแต่ละวัน"
      actions={
        <div className="flex items-center gap-2">
          {summary && summary.vehicles.length > 0 && (
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download size={16} />
              <span>ส่งออก CSV</span>
            </Button>
          )}
          <Button
            onClick={() => fetchSummary(selectedDate)}
            variant="outline"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </Button>
        </div>
      }
      loading={loading}
      error={!!error}
      onRetry={() => fetchSummary(selectedDate)}
    >
      {/* Date Selector */}
      <Card className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-slate-500 dark:text-slate-400" size={20} />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              วันที่:
            </span>
            <input
              type="date"
              value={selectedDate}
              max={maxDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePreviousDay}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              <span>วันก่อน</span>
            </Button>
            {!isToday && (
              <Button
                onClick={handleToday}
                variant="outline"
                size="sm"
              >
                วันนี้
              </Button>
            )}
            <Button
              onClick={handleNextDay}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              disabled={selectedDate >= maxDate}
            >
              <span>วันถัดไป</span>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Branch Filter */}
      {summary && branches.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">
              สาขา:
            </span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 text-sm"
            >
              <option value="all">ทุกสาขา</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {getBranchLabel(branch)}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                    จำนวนรถที่ใช้งาน
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {summary.total_vehicles}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    คัน
                  </p>
                </div>
                <div className="p-3 bg-enterprise-100 dark:bg-enterprise-900/30 rounded-lg">
                  <Truck className="text-enterprise-600 dark:text-enterprise-400" size={24} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                    จำนวนทริปทั้งหมด
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {summary.total_trips}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    ทริป
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Route className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                    ระยะทางรวม
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {summary.total_distance_km.toLocaleString('th-TH')}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    กิโลเมตร
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="text-green-600 dark:text-green-400" size={24} />
                </div>
              </div>
            </Card>
          </div>

          {/* Vehicle Details Table */}
          {summary.vehicles.length > 0 ? (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  รายละเอียดตามรถ
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          ทะเบียนรถ
                        </th>
                        <th className="text-left py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          ยี่ห้อ/รุ่น
                        </th>
                        <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          จำนวนทริป
                        </th>
                        <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          ระยะทางรวม (กม.)
                        </th>
                        <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          ไมล์เริ่มต้น
                        </th>
                        <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          ไมล์สิ้นสุด
                        </th>
                        <th className="text-left py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          พนักงานที่ใช้รถ
                        </th>
                        <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          ทริป
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.vehicles
                        .filter((v) => branchFilter === 'all' || v.branch === branchFilter)
                        .sort((a, b) => b.total_distance_km - a.total_distance_km)
                        .map((vehicle, index) => (
                          <tr
                            key={vehicle.vehicle_id}
                            className={`border-b border-slate-100 dark:border-slate-800 ${
                              index % 2 === 0
                                ? 'bg-slate-50/50 dark:bg-slate-900/50'
                                : 'bg-white dark:bg-slate-900'
                            }`}
                          >
                            <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                              {vehicle.vehicle_plate}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {vehicle.vehicle_make && vehicle.vehicle_model
                                ? `${vehicle.vehicle_make} ${vehicle.vehicle_model}`
                                : '-'}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                              {vehicle.trip_count}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-medium">
                              {vehicle.total_distance_km.toLocaleString('th-TH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                              {vehicle.odometer_start?.toLocaleString('th-TH') || '-'}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                              {vehicle.odometer_end?.toLocaleString('th-TH') || '-'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {vehicle.drivers.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {vehicle.drivers.map((driver, idx) => (
                                    <span key={idx} className="text-sm">
                                      {driver}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {vehicle.trip_count > 0 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewVehicleTrips(vehicle)}
                                >
                                  ดูทริป
                                </Button>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600 text-sm">
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-12 text-center">
                <Truck className="mx-auto text-slate-400 dark:text-slate-600 mb-4" size={48} />
                <p className="text-slate-600 dark:text-slate-400 text-lg mb-2">
                  ไม่มีข้อมูลการใช้รถในวันที่เลือก
                </p>
                <p className="text-slate-500 dark:text-slate-500 text-sm">
                  {formatDate(selectedDate)}
                </p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Vehicle Trips Detail Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Route className="w-5 h-5" />
                  รายละเอียดทริปของรถ {selectedVehicle.vehicle_plate}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(selectedDate)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedVehicle(null);
                  setVehicleTrips([]);
                  setTripsError(null);
                }}
              >
                ปิด
              </Button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4">
              {loadingTrips ? (
                <div className="flex items-center justify-center py-8 text-slate-500 dark:text-slate-400 gap-2">
                  <RefreshCw size={18} className="animate-spin" />
                  <span>กำลังโหลดรายละเอียดทริป...</span>
                </div>
              ) : tripsError ? (
                <div className="text-sm text-red-500 dark:text-red-400 py-4">
                  {tripsError}
                </div>
              ) : vehicleTrips.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Route className="mx-auto mb-4 text-slate-400 dark:text-slate-600" size={32} />
                  <p>ไม่มีทริปของรถคันนี้ในวันที่เลือก</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                        <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          รหัสทริป
                        </th>
                        <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          เวลาออก
                        </th>
                        <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          เวลากลับ
                        </th>
                        <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          เลขไมล์ออก
                        </th>
                        <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          เลขไมล์กลับ
                        </th>
                        <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          ระยะทาง (กม.)
                        </th>
                        <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          คนขับ
                        </th>
                        <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          ปลายทาง / เส้นทาง
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleTrips.map((trip) => {
                        const checkoutDate = trip.checkout_time ? new Date(trip.checkout_time) : null;
                        const checkinDate = trip.checkin_time ? new Date(trip.checkin_time) : null;
                        const odometerStart = trip.odometer_start || 0;
                        const odometerEnd = trip.odometer_end || 0;
                        const distance =
                          odometerStart && odometerEnd && odometerEnd > odometerStart
                            ? odometerEnd - odometerStart
                            : null;

                        return (
                          <tr
                            key={trip.id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          >
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {trip.delivery_trip?.trip_number ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (trip.delivery_trip?.id && onViewDeliveryTrip) {
                                      onViewDeliveryTrip(trip.delivery_trip.id);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-enterprise-600 dark:text-enterprise-400 bg-enterprise-50 dark:bg-enterprise-900/30 px-2 py-0.5 rounded group hover:bg-enterprise-100 dark:hover:bg-enterprise-900/60 focus:outline-none"
                                  title="ดูรายละเอียดทริปส่งสินค้า"
                                >
                                  <Package
                                    size={12}
                                    className="group-hover:text-enterprise-700 dark:group-hover:text-enterprise-300 transition-colors"
                                  />
                                  <span className="underline-offset-2 group-hover:underline">
                                    {trip.delivery_trip.trip_number}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600 text-xs">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {checkoutDate
                                ? checkoutDate.toLocaleTimeString('th-TH', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {checkinDate
                                ? checkinDate.toLocaleTimeString('th-TH', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {trip.odometer_start !== null && trip.odometer_start !== undefined
                                ? trip.odometer_start.toLocaleString('th-TH')
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {trip.odometer_end !== null && trip.odometer_end !== undefined
                                ? trip.odometer_end.toLocaleString('th-TH')
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {distance !== null
                                ? distance.toLocaleString('th-TH')
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {trip.driver?.full_name || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-200">
                              {trip.destination || trip.route || trip.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};

