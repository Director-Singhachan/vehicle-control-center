import React from 'react';
import { Car, Route, Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import type { StaffVehicleUsageSummary } from '../../services/staffVehicleUsageService';

interface StaffVehicleUsageCardProps {
  summary: StaffVehicleUsageSummary;
}

const formatNumber = (n: number, digits: number = 0) => {
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const StaffVehicleUsageCard: React.FC<StaffVehicleUsageCardProps> = ({ summary }) => {
  const lastActivityText = summary.last_activity_at
    ? new Date(summary.last_activity_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '-';

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">สรุปการเดินทาง</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">อัปเดตล่าสุด: {lastActivityText}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
          <Route className="text-enterprise-600 dark:text-enterprise-400" size={22} />
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">ทริปที่เข้าร่วม</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(summary.total_trips)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
          <Car className="text-enterprise-600 dark:text-enterprise-400" size={22} />
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">รถที่เกี่ยวข้อง</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(summary.vehicles_used)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
          <Route className="text-enterprise-600 dark:text-enterprise-400" size={22} />
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">ระยะทางรวมของทริป (กม.)</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(summary.total_distance_km, 1)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
          <Clock className="text-enterprise-600 dark:text-enterprise-400" size={22} />
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">เวลารวมของทริป (ชม.)</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(summary.total_duration_hours, 1)}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};
