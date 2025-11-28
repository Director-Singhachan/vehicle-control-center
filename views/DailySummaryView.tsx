// Daily Summary View - สรุปการใช้รถรายวัน
import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { dailySummaryService, type DailySummary, type DailyVehicleSummary } from '../services/dailySummaryService';

interface DailySummaryViewProps {
  isDark?: boolean;
}

export const DailySummaryView: React.FC<DailySummaryViewProps> = ({ isDark = false }) => {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

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
      error={error}
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
                      </tr>
                    </thead>
                    <tbody>
                      {summary.vehicles
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
    </PageLayout>
  );
};

