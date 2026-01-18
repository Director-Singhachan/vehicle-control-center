import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, User, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Users, ExternalLink } from 'lucide-react';
import { useTripLogs } from '../../hooks/useTripLogs';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface VehicleDriverHistoryProps {
  vehicleId: string;
  onViewDeliveryTrip?: (deliveryTripId: string) => void;
}

const toISODate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toStartOfDayISO = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return dt.toISOString();
};

const toEndOfDayISO = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return dt.toISOString();
};

const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatNumber = (n: number | null, digits: number = 1) => {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const VehicleDriverHistory: React.FC<VehicleDriverHistoryProps> = ({ vehicleId, onViewDeliveryTrip }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState('');
  const pageSize = 20;

  const [fromDraft, setFromDraft] = React.useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return toISODate(d);
  });
  const [toDraft, setToDraft] = React.useState<string>(() => toISODate(new Date()));

  const [from, setFrom] = React.useState<string>(fromDraft);
  const [to, setTo] = React.useState<string>(toDraft);

  const startDate = React.useMemo(() => (from ? toStartOfDayISO(from) : undefined), [from]);
  const endDate = React.useMemo(() => (to ? toEndOfDayISO(to) : undefined), [to]);

  const { trips, totalCount, loading, refetch } = useTripLogs({
    vehicle_id: vehicleId,
    start_date: startDate,
    end_date: endDate,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  const summary = React.useMemo(() => {
    const byDriver = new Map<
      string,
      {
        driver_id: string;
        driver_name: string;
        count: number;
        last_checkout_time: string | null;
      }
    >();

    trips.forEach((t) => {
      const driverId = (t as any).driver_id as string;
      const name = t.driver?.full_name || 'ไม่ระบุ';
      const existing = byDriver.get(driverId);
      const checkoutTime = (t as any).checkout_time as string;

      if (!existing) {
        byDriver.set(driverId, {
          driver_id: driverId,
          driver_name: name,
          count: 1,
          last_checkout_time: checkoutTime || null,
        });
        return;
      }

      existing.count += 1;
      if (checkoutTime) {
        const existingTs = existing.last_checkout_time ? new Date(existing.last_checkout_time).getTime() : 0;
        const newTs = new Date(checkoutTime).getTime();
        if (newTs > existingTs) existing.last_checkout_time = checkoutTime;
      }
    });

    const list = Array.from(byDriver.values()).sort((a, b) => b.count - a.count);

    return {
      drivers: list,
      driversCount: list.length,
      totalSessions: totalCount,
    };
  }, [trips, totalCount]);

  const onApply = () => {
    setError(null);

    if (fromDraft && toDraft && fromDraft > toDraft) {
      setError('ช่วงเวลาไม่ถูกต้อง: วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
      return;
    }

    setFrom(fromDraft);
    setTo(toDraft);
    setCurrentPage(1);
  };

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [from, to]);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            ประวัติคนขับของคันนี้
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            แสดงจากบันทึกการใช้งานรถ (รวมทั้งทริปส่งสินค้าและใช้นอกทริป)
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} isLoading={loading}>
          <RefreshCw size={18} className="mr-2" />
          รีเฟรช
        </Button>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">ช่วงเวลา</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">เริ่มต้น</label>
            <input
              type="date"
              value={fromDraft}
              onChange={(e) => setFromDraft(e.target.value)}
              max={toDraft || undefined}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">สิ้นสุด</label>
            <input
              type="date"
              value={toDraft}
              onChange={(e) => setToDraft(e.target.value)}
              min={fromDraft || undefined}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-end lg:col-span-2">
            <Button onClick={onApply} className="w-full">ค้นหา</Button>
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">จำนวนครั้งที่ขับ (ช่วงที่เลือก)</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.totalSessions.toLocaleString('th-TH')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">จำนวนคนขับ</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.driversCount.toLocaleString('th-TH')}</div>
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">สรุปตามคนขับ</h3>
        {summary.driversCount === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">ไม่พบข้อมูลในช่วงเวลานี้</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">คนขับ</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">ครั้ง</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">ขับล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {summary.drivers.map((d) => (
                  <tr key={d.driver_id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{d.driver_name}</td>
                    <td className="px-3 py-2 text-right text-slate-800 dark:text-slate-100">{d.count.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDateTime(d.last_checkout_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">รายละเอียดแต่ละครั้ง</h3>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            แสดง {totalCount > 0 ? startIndex + 1 : 0}-{endIndex} จาก {totalCount.toLocaleString('th-TH')} รายการ
            {totalPages > 1 && (
              <span className="ml-2">(ทั้งหมด {totalPages.toLocaleString('th-TH')} หน้า)</span>
            )}
          </div>
        </div>
        {trips.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">ไม่พบข้อมูลในช่วงเวลานี้</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">ออกเวลา</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">กลับเวลา</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">คนขับ</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">ไปยัง</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">เส้นทาง</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">ทริป</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">ระยะทาง (กม.)</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => {
                  const deliveryTripId = (t as any).delivery_trip_id as string | null;
                  return (
                    <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 text-center text-slate-800 dark:text-slate-100">{formatDateTime((t as any).checkout_time)}</td>
                      <td className="px-3 py-2 text-center text-slate-800 dark:text-slate-100">{formatDateTime((t as any).checkin_time)}</td>
                      <td className="px-3 py-2 text-center text-slate-800 dark:text-slate-100">{t.driver?.full_name || 'ไม่ระบุ'}</td>
                      <td className="px-3 py-2 text-center text-slate-800 dark:text-slate-100">{(t as any).destination || '-'}</td>
                      <td className="px-3 py-2 text-center text-slate-800 dark:text-slate-100">{(t as any).route || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {deliveryTripId && onViewDeliveryTrip ? (
                          <button
                            onClick={() => onViewDeliveryTrip(deliveryTripId)}
                            className="text-enterprise-600 hover:text-enterprise-800 hover:underline flex items-center gap-1"
                          >
                            {t.delivery_trip?.trip_number || deliveryTripId}
                            <ExternalLink size={14} />
                          </button>
                        ) : deliveryTripId ? (
                          <span className="text-slate-600 dark:text-slate-400">{t.delivery_trip?.trip_number || deliveryTripId}</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">นอกทริป</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-800 dark:text-slate-100">{formatNumber((t as any).distance_km)}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${t.status === 'checked_in'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}
                        >
                          {t.status === 'checked_in' ? 'กลับแล้ว' : 'ยังไม่กลับ'}
                        </span>
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
  );
};
