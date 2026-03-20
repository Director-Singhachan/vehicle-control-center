import React from 'react';
import { Card } from '../ui/Card';
import { Package, Clock, CheckCircle, Navigation, Archive, XCircle } from 'lucide-react';

interface TrackOrdersStatsProps {
  stats: {
    total: number;
    pending: number;
    partial: number;
    assigned: number;
    in_delivery: number;
    delivered: number;
  };
}

export const TrackOrdersStats: React.FC<TrackOrdersStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {/* Total */}
      <Card className="border-0 shadow-sm overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-charcoal-900/50 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="p-4 relative flex flex-col items-center justify-center min-h-[100px]">
          <Package className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute top-3 right-3 opacity-20" />
          <div className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white mb-1">
            {stats.total.toLocaleString()}
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            ทั้งหมด
          </div>
        </div>
      </Card>

      {/* Pending */}
      <Card className="border-0 shadow-sm overflow-hidden group ring-1 ring-inset ring-amber-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-charcoal-900/50 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="p-4 relative flex flex-col items-center justify-center min-h-[100px]">
          <Clock className="w-5 h-5 text-amber-500 absolute top-3 right-3 opacity-20" />
          <div className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mb-1">
            {stats.pending.toLocaleString()}
          </div>
          <div className="text-sm font-medium text-amber-700/80 dark:text-amber-500/80">
            รอจัดทริป
          </div>
        </div>
      </Card>

      {/* Partial */}
      <Card className={`border-0 shadow-sm overflow-hidden group ring-2 ring-inset transition-all ${stats.partial > 0 ? 'ring-orange-400/40 dark:ring-orange-500/30' : 'ring-slate-200/50 dark:ring-slate-700/50 opacity-70'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-charcoal-900/50 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="p-4 relative flex flex-col items-center justify-center min-h-[100px]">
          <Archive className="w-5 h-5 text-orange-500 absolute top-3 right-3 opacity-20" />
          <div className="text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-400 mb-1">
            {stats.partial.toLocaleString()}
          </div>
          <div className="text-sm font-semibold text-orange-700/90 dark:text-orange-400/90 flex items-center gap-1">
            <span className="text-xs">⏳</span> ส่งบางส่วน
          </div>
        </div>
      </Card>

      {/* Assigned */}
      <Card className="border-0 shadow-sm overflow-hidden group ring-1 ring-inset ring-neon-blue/10">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 to-white dark:from-sky-900/20 dark:to-charcoal-900/50 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="p-4 relative flex flex-col items-center justify-center min-h-[100px]">
          <CheckCircle className="w-5 h-5 text-neon-blue absolute top-3 right-3 opacity-20" />
          <div className="text-3xl font-bold tracking-tight text-sky-600 dark:text-sky-400 mb-1">
            {stats.assigned.toLocaleString()}
          </div>
          <div className="text-sm font-medium text-sky-700/80 dark:text-sky-400/80">
            กำหนดทริปแล้ว
          </div>
        </div>
      </Card>

      {/* In Delivery */}
      <Card className="border-0 shadow-sm overflow-hidden group ring-1 ring-inset ring-neon-alert/10">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-50 to-white dark:from-fuchsia-900/20 dark:to-charcoal-900/50 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="p-4 relative flex flex-col items-center justify-center min-h-[100px]">
          <Navigation className="w-5 h-5 text-neon-alert absolute top-3 right-3 opacity-20" />
          <div className="text-3xl font-bold tracking-tight text-fuchsia-600 dark:text-fuchsia-400 mb-1">
            {stats.in_delivery.toLocaleString()}
          </div>
          <div className="text-sm font-medium text-fuchsia-700/80 dark:text-fuchsia-400/80">
            กำลังจัดส่ง
          </div>
        </div>
      </Card>

      {/* Delivered */}
      <Card className="border-0 shadow-sm overflow-hidden group ring-1 ring-inset ring-emerald-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-charcoal-900/50 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="p-4 relative flex flex-col items-center justify-center min-h-[100px]">
          <CheckCircle className="w-5 h-5 text-emerald-500 absolute top-3 right-3 opacity-20" />
          <div className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mb-1">
            {stats.delivered.toLocaleString()}
          </div>
          <div className="text-sm font-medium text-emerald-700/80 dark:text-emerald-500/80">
            จัดส่งแล้ว
          </div>
        </div>
      </Card>
    </div>
  );
};
