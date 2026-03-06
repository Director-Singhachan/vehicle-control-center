import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { StaffVehicleUsageTripRow } from '../../services/staffVehicleUsageService';

interface StaffTripHistoryTableProps {
  trips: StaffVehicleUsageTripRow[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onViewTrip?: (tripId: string) => void;
}

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

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatNumber = (n: number | null, digits: number = 1) => {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const StaffTripHistoryTable: React.FC<StaffTripHistoryTableProps> = ({
  trips,
  page,
  pageSize,
  onPageChange,
  onViewTrip,
}) => {
  const safePageSize = Math.max(1, pageSize);
  const total = trips.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = startIndex + safePageSize;
  const pageTrips = trips.slice(startIndex, endIndex);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">ประวัติทริป</h3>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          ทั้งหมด {total.toLocaleString('th-TH')} รายการ
          {' · '}
          หน้า {safePage.toLocaleString('th-TH')}/{totalPages.toLocaleString('th-TH')}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">วันที่</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ทริป</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รถ</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">บทบาท</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">สถานะ</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ระยะทาง (กม.)</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เวลา (ชม.)</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เริ่มงาน</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จบงาน</th>
            </tr>
          </thead>
          <tbody>
            {pageTrips.map((t) => (
              <tr
                key={`${t.delivery_trip_id}-${t.start_at}`}
                className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  onViewTrip ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (!onViewTrip) return;
                  if (!t.delivery_trip_id) return;
                  onViewTrip(t.delivery_trip_id);
                }}
              >
                <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{formatDate(t.planned_date)}</td>
                <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{t.trip_number || '-'}</td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  {t.vehicle_plate ? `${t.vehicle_plate}${t.vehicle_make || t.vehicle_model ? ` (${t.vehicle_make || ''} ${t.vehicle_model || ''})`.replace(/\s+/g, ' ').trim() : ''}` : '-'}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t.role || '-'}</td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t.crew_status || '-'}</td>
                <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(t.distance_km, 1)}</td>
                <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{formatNumber(t.duration_hours, 1)}</td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDateTime(t.start_at)}</td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDateTime(t.end_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          แสดง {(total === 0 ? 0 : startIndex + 1).toLocaleString('th-TH')}-{Math.min(endIndex, total).toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} รายการ
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
          >
            ก่อนหน้า
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          >
            ถัดไป
          </Button>
        </div>
      </div>

      {total === 0 && (
        <div className="py-10 text-center text-slate-500 dark:text-slate-400">ไม่มีข้อมูลประวัติทริป</div>
      )}
    </Card>
  );
};
